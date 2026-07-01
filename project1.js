/**
 * BookExchange Backend Server â€” MySQL Edition
 * Campus second-hand book marketplace
 * Stack: Express Â· Socket.IO Â· MySQL2 Â· JWT Â· bcryptjs
 *
 * Setup:
 *   npm install express mysql2 socket.io jsonwebtoken bcryptjs
 *                express-fileupload uuid cors dotenv
 *
 * Create a .env file:
 *   DB_HOST=localhost
 *   DB_PORT=3306
 *   DB_USER=root
 *   DB_PASSWORD=yourpassword
 *   DB_NAME=book_exchange_db
 *   JWT_SECRET=bookexchange_super_secret_2024
 *   PORT=5000
 */

require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const fileUpload   = require('express-fileupload');
const path         = require('path');
const fs           = require('fs');
const { v4: uuidv4 } = require('uuid');
const mysql        = require('mysql2/promise');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'bookexchange_super_secret_2024';
const PORT       = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PDF_DIR    = path.join(__dirname, 'private_uploads', 'pdfs');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

// â”€â”€â”€ DATABASE POOL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'book_exchange_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
});

// Shorthand query helpers
const query = (sql, params) => pool.execute(sql, params);
const qOne  = async (sql, params) => { const [rows] = await pool.execute(sql, params); return rows[0] || null; };
const qAll  = async (sql, params) => { const [rows] = await pool.execute(sql, params); return rows; };

// â”€â”€â”€ MIDDLEWARE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ limits: { fileSize: 25 * 1024 * 1024 }, createParentPath: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'frontend')));

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch {} }
  next();
}

async function saveUploadedFile(file, folder, allowedExts) {
  const ext = path.extname(file.name || '').toLowerCase();
  if (!allowedExts.includes(ext)) throw new Error(`Only ${allowedExts.join(', ')} files are allowed`);
  const fname = uuidv4() + ext;
  await file.mv(path.join(folder, fname));
  return { filename: fname, originalName: file.name };
}

function publicListing(listing) {
  const { pdf_file_path, ...safe } = listing;
  return { ...safe, has_pdf: Boolean(pdf_file_path) };
}

// â”€â”€â”€ HEALTH CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});

// â”€â”€â”€ AUTH ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, branch, year, college } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, and password are required.' });

    const existing = await qOne('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered.' });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO Users (name, email, password_hash, phone, department, year, college_name, trust_score, total_ratings, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 5.00, 0, 0)`,
      [name, email, password_hash, phone || null, branch || null, year || null,
       college || 'Vardhaman College of Engineering']
    );
    const userId = result.insertId;
    const token = jwt.sign({ id: userId, email, name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, name, email, branch: branch || null, year: year || null } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await qOne('SELECT * FROM Users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    const ok = await bcrypt.compare(password, user.password_hash).catch(() => false);
    const seededDemoOk = (user.password_hash || '').startsWith('$2b$10$xSampleHash') && password === 'password123';
    if (!ok && !seededDemoOk) return res.status(401).json({ error: 'Invalid email or password.' });
    await pool.execute('UPDATE Users SET last_active_at = NOW() WHERE user_id = ?', [user.user_id]);
    const token = jwt.sign({ id: user.user_id, email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.user_id, name: user.name, email, branch: user.department, year: user.year } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ USER ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/users/me', auth, async (req, res) => {
  try {
    const user = await qOne('SELECT * FROM Users WHERE user_id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const listings = await qAll(
      `SELECT l.*, b.title, b.subject, b.cover_image FROM Listings l
       JOIN Books b ON l.book_id = b.book_id
       WHERE l.seller_id = ? ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    const ratings     = await qAll('SELECT * FROM Ratings WHERE rated_user_id = ?', [req.user.id]);
    const givenCount  = await qOne('SELECT COUNT(*) AS cnt FROM Ratings WHERE rater_id = ?', [req.user.id]);
    const txns        = await qAll(
      'SELECT * FROM Transactions WHERE buyer_id = ? OR seller_id = ?',
      [req.user.id, req.user.id]
    );
    const goals       = await qAll('SELECT * FROM Reading_Goals WHERE user_id = ?', [req.user.id]);

    const { password_hash, ...safeUser } = user;
    res.json({
      ...safeUser, id: user.user_id,
      listings: listings.map(publicListing),
      ratings_received: ratings,
      ratings_given_count: givenCount?.cnt || 0,
      transaction_count: txns.length,
      reading_goals: goals,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/me', auth, async (req, res) => {
  try {
    const { name, phone, department, bio, year, college_name, upi_id } = req.body;
    const existing = await qOne('SELECT * FROM Users WHERE user_id = ?', [req.user.id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    let upiQrImage = null;
    if (req.files?.upi_qr) {
      const saved = await saveUploadedFile(req.files.upi_qr, UPLOAD_DIR, ['.jpg', '.jpeg', '.png', '.webp']);
      upiQrImage = '/uploads/' + saved.filename;
    }
    await pool.execute(
      `UPDATE Users
       SET name=?, phone=?, department=?, bio=?, year=?, college_name=?, upi_id=?,
           upi_qr_image=COALESCE(?, upi_qr_image), updated_at=NOW()
       WHERE user_id=?`,
      [
        name ?? existing.name,
        phone ?? existing.phone,
        department ?? existing.department,
        bio ?? existing.bio,
        year ?? existing.year,
        college_name ?? existing.college_name,
        upi_id ?? existing.upi_id,
        upiQrImage,
        req.user.id
      ]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/profile', async (req, res) => {
  try {
    const user = await qOne('SELECT * FROM Users WHERE user_id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const listings = await qAll(
      `SELECT l.*, b.title, b.author, b.cover_image FROM Listings l
       JOIN Books b ON l.book_id = b.book_id
       WHERE l.seller_id = ? AND l.status = 'active' ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    const ratings = await qAll(
      `SELECT r.*, u.name AS rater_name FROM Ratings r
       JOIN Users u ON r.rater_id = u.user_id
       WHERE r.rated_user_id = ? ORDER BY r.created_at DESC LIMIT 10`,
      [req.params.id]
    );
    const { password_hash, ...safeUser } = user;
    res.json({ ...safeUser, id: user.user_id, active_listings: listings.map(publicListing), ratings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ BOOKS ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/books', async (req, res) => {
  try {
    const { search, category, semester } = req.query;
    let sql = 'SELECT * FROM Books WHERE 1=1';
    const params = [];

    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (semester) { sql += ' AND semester = ?'; params.push(semester); }
    if (search) {
      sql += ' AND MATCH(title, author, subject) AGAINST(? IN BOOLEAN MODE)';
      params.push(search + '*');
    }
    sql += ' ORDER BY rating DESC LIMIT 100';

    const books = await qAll(sql, params);
    res.json(books.map(b => ({ ...b, id: b.book_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/books/recommend', auth, async (req, res) => {
  try {
    const user = await qOne('SELECT department FROM Users WHERE user_id = ?', [req.user.id]);
    const dept = user?.department || 'CSE';
    const books = await qAll(
      `SELECT * FROM Books WHERE category = ? OR category = 'ALL'
       ORDER BY rating DESC LIMIT 8`,
      [dept]
    );
    res.json(books.map(b => ({ ...b, id: b.book_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/books/trending', async (req, res) => {
  try {
    const books = await qAll(
      'SELECT * FROM Books ORDER BY total_reviews DESC, views_count DESC LIMIT 8'
    );
    res.json(books.map(b => ({ ...b, id: b.book_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await qOne('SELECT * FROM Books WHERE book_id = ?', [req.params.id]);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    await pool.execute('UPDATE Books SET views_count = views_count + 1 WHERE book_id = ?', [req.params.id]);

    const listings = await qAll(
      `SELECT l.*, u.name AS seller_name, u.trust_score, u.total_ratings
       FROM Listings l JOIN Users u ON l.seller_id = u.user_id
       WHERE l.book_id = ? AND l.status = 'active'`,
      [req.params.id]
    );
    const reviews = await qAll(
      `SELECT br.*, u.name AS reviewer_name FROM Book_Reviews br
       JOIN Users u ON br.user_id = u.user_id
       WHERE br.book_id = ? ORDER BY br.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...book, id: book.book_id, active_listings: listings, reviews });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/books', auth, async (req, res) => {
  try {
    const { title, author, isbn, subject, category, semester, publisher, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const existing = await qOne('SELECT * FROM Books WHERE title = ? AND author = ?', [title, author || '']);
    if (existing) return res.json({ ...existing, id: existing.book_id });

    const [result] = await pool.execute(
      `INSERT INTO Books (title, author, isbn, subject, category, semester, publisher, description, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author || '', isbn || null, subject || '', category || 'ALL',
       semester || null, publisher || null, description || '', req.user.id]
    );
    const book = await qOne('SELECT * FROM Books WHERE book_id = ?', [result.insertId]);
    res.status(201).json({ ...book, id: book.book_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ LISTINGS ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/listings', optionalAuth, async (req, res) => {
  try {
    const { search, branch, condition, type, sort, min_price, max_price, semester } = req.query;
    let sql = `SELECT l.*, b.title, b.author, b.subject, b.isbn, b.semester, b.cover_image,
                      b.category, b.rating AS book_rating,
                      u.name AS seller_name, u.trust_score, u.department AS seller_dept
               FROM Listings l
               JOIN Books b ON l.book_id = b.book_id
               JOIN Users u ON l.seller_id = u.user_id
               WHERE l.status = 'active'`;
    const params = [];

    if (search) {
      sql += ' AND MATCH(b.title, b.author, b.subject) AGAINST(? IN BOOLEAN MODE)';
      params.push(search + '*');
    }
    if (branch)    { sql += ' AND b.category = ?';            params.push(branch); }
    if (condition) { sql += ' AND l.condition_rating = ?';    params.push(condition); }
    if (type)      { sql += ' AND l.listing_type = ?';        params.push(type); }
    if (semester)  { sql += ' AND b.semester = ?';            params.push(Number(semester)); }
    if (min_price) { sql += ' AND l.price >= ?';              params.push(Number(min_price)); }
    if (max_price) { sql += ' AND l.price <= ?';              params.push(Number(max_price)); }

    if (sort === 'price_asc')  sql += ' ORDER BY l.price ASC';
    else if (sort === 'price_desc') sql += ' ORDER BY l.price DESC';
    else if (sort === 'rating') sql += ' ORDER BY u.trust_score DESC';
    else sql += ' ORDER BY l.created_at DESC';

    sql += ' LIMIT 100';

    const listings = await qAll(sql, params);
    res.json(listings.map(l => publicListing({ ...l, id: l.listing_id, condition_label: l.condition_rating })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/listings/:id', optionalAuth, async (req, res) => {
  try {
    const l = await qOne(
      `SELECT l.*, b.title, b.author, b.subject, b.isbn, b.semester, b.cover_image,
              b.description AS book_desc, b.publisher,
              u.name AS seller_name, u.email AS seller_email, u.upi_id, u.upi_qr_image,
              u.trust_score, u.total_ratings
       FROM Listings l
       JOIN Books b ON l.book_id = b.book_id
       JOIN Users u ON l.seller_id = u.user_id
       WHERE l.listing_id = ?`,
      [req.params.id]
    );
    if (!l) return res.status(404).json({ error: 'Listing not found' });

    await pool.execute('UPDATE Listings SET views_count = views_count + 1 WHERE listing_id = ?', [req.params.id]);
    res.json(publicListing({ ...l, id: l.listing_id, condition_label: l.condition_rating }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/listings', auth, async (req, res) => {
  try {
    let { book_id, listing_type, fulfillment_mode, price, condition_label, description, preferred_exchange, location } = req.body;
    if (!book_id)         return res.status(400).json({ error: 'Book required' });
    if (!condition_label) return res.status(400).json({ error: 'Condition required' });
    fulfillment_mode = ['physical', 'online', 'both'].includes(fulfillment_mode) ? fulfillment_mode : 'physical';

    let cover_image = null;
    if (req.files?.image) {
      const saved = await saveUploadedFile(req.files.image, UPLOAD_DIR, ['.jpg', '.jpeg', '.png', '.webp']);
      cover_image = '/uploads/' + saved.filename;
    }

    let pdfPath = null;
    let pdfOriginalName = null;
    if (req.files?.pdf_file) {
      const saved = await saveUploadedFile(req.files.pdf_file, PDF_DIR, ['.pdf']);
      pdfPath = path.join('private_uploads', 'pdfs', saved.filename);
      pdfOriginalName = saved.originalName;
    }
    if ((fulfillment_mode === 'online' || fulfillment_mode === 'both') && !pdfPath) {
      return res.status(400).json({ error: 'Upload a PDF for online book delivery.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO Listings (seller_id, book_id, listing_type, fulfillment_mode, price, condition_rating,
                             condition_notes, cover_image_override, pdf_file_path, pdf_original_name,
                             preferred_exchange, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.user.id, book_id, listing_type || 'sale', fulfillment_mode, price ? parseFloat(price) : null,
       condition_label, description || '', cover_image, pdfPath, pdfOriginalName,
       preferred_exchange || null, location || null]
    );

    // Notify wishlist users
    const wishers = await qAll(
      'SELECT user_id FROM Wishlists WHERE book_id = ? AND notify_available = 1 AND user_id != ?',
      [book_id, req.user.id]
    );
    if (wishers.length) {
      const book = await qOne('SELECT title FROM Books WHERE book_id = ?', [book_id]);
      for (const w of wishers) {
        await pool.execute(
          `INSERT INTO Notifications (user_id, type, message, related_id)
           VALUES (?, 'wishlist_available', ?, ?)`,
          [w.user_id, `Good news! "${book?.title}" you wishlisted is now available.`, result.insertId]
        );
      }
    }

    const listing = await qOne('SELECT * FROM Listings WHERE listing_id = ?', [result.insertId]);
    res.status(201).json(publicListing({ ...listing, id: listing.listing_id }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/listings/:id', auth, async (req, res) => {
  try {
    const l = await qOne('SELECT * FROM Listings WHERE listing_id = ?', [req.params.id]);
    if (!l) return res.status(404).json({ error: 'Not found' });
    if (l.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { price, condition_label, description, status } = req.body;
    await pool.execute(
      'UPDATE Listings SET price=?, condition_rating=?, condition_notes=?, status=?, updated_at=NOW() WHERE listing_id=?',
      [price, condition_label, description, status, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/listings/:id', auth, async (req, res) => {
  try {
    const l = await qOne('SELECT * FROM Listings WHERE listing_id = ?', [req.params.id]);
    if (!l) return res.status(404).json({ error: 'Not found' });
    if (l.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await pool.execute("UPDATE Listings SET status='closed', updated_at=NOW() WHERE listing_id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ WISHLIST ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/wishlist', auth, async (req, res) => {
  try {
    const items = await qAll(
      `SELECT w.*, b.title, b.author, b.cover_image, b.rating,
              (SELECT COUNT(*) FROM Listings WHERE book_id = w.book_id AND status = 'active') AS available_count
       FROM Wishlists w
       JOIN Books b ON w.book_id = b.book_id
       WHERE w.user_id = ?`,
      [req.user.id]
    );
    res.json(items.map(i => ({ ...i, id: i.book_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wishlist', auth, async (req, res) => {
  try {
    const { book_id, max_price, notify_price_drop } = req.body;
    const existing = await qOne('SELECT wishlist_id FROM Wishlists WHERE user_id = ? AND book_id = ?', [req.user.id, book_id]);
    if (existing) return res.status(409).json({ error: 'Already in wishlist' });
    const [r] = await pool.execute(
      'INSERT INTO Wishlists (user_id, book_id, max_price, notify_available, notify_price_drop) VALUES (?, ?, ?, 1, ?)',
      [req.user.id, book_id, max_price || null, notify_price_drop ? 1 : 0]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/wishlist/:bookId', auth, async (req, res) => {
  try {
    await pool.execute('DELETE FROM Wishlists WHERE user_id = ? AND book_id = ?', [req.user.id, req.params.bookId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ CHAT ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/chat/rooms', auth, async (req, res) => {
  try {
    const rooms = await qAll(
      `SELECT c.*, b.title AS book_title,
              buyer.name AS buyer_name, seller.name AS seller_name,
              (SELECT COUNT(*) FROM Messages m WHERE m.chat_id = c.chat_id AND m.sender_id != ? AND m.is_read = 0) AS unread_count,
              (SELECT message_text FROM Messages m2 WHERE m2.chat_id = c.chat_id ORDER BY sent_at DESC LIMIT 1) AS last_message
       FROM Chats c
       JOIN Listings l ON c.listing_id = l.listing_id
       JOIN Books b ON l.book_id = b.book_id
       JOIN Users buyer ON c.buyer_id = buyer.user_id
       JOIN Users seller ON c.seller_id = seller.user_id
       WHERE c.buyer_id = ? OR c.seller_id = ?
       ORDER BY c.last_message_at DESC, c.created_at DESC`,
      [req.user.id, req.user.id, req.user.id]
    );
    res.json(rooms.map(r => ({ ...r, id: r.chat_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat/rooms', auth, async (req, res) => {
  try {
    const { listing_id } = req.body;
    const listing = await qOne('SELECT * FROM Listings WHERE listing_id = ?', [listing_id]);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id === req.user.id) return res.status(400).json({ error: 'Cannot chat with yourself' });

    let room = await qOne('SELECT * FROM Chats WHERE listing_id = ? AND buyer_id = ?', [listing_id, req.user.id]);
    if (!room) {
      const [r] = await pool.execute(
        "INSERT INTO Chats (listing_id, buyer_id, seller_id, status) VALUES (?, ?, ?, 'active')",
        [listing_id, req.user.id, listing.seller_id]
      );
      room = await qOne('SELECT * FROM Chats WHERE chat_id = ?', [r.insertId]);
    }
    res.json({ ...room, id: room.chat_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chat/rooms/:id/messages', auth, async (req, res) => {
  try {
    const room = await qOne('SELECT * FROM Chats WHERE chat_id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.buyer_id !== req.user.id && room.seller_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const msgs = await qAll(
      `SELECT m.*, u.name AS sender_name FROM Messages m
       JOIN Users u ON m.sender_id = u.user_id
       WHERE m.chat_id = ? ORDER BY m.sent_at ASC`,
      [req.params.id]
    );
    // Mark as read
    await pool.execute(
      'UPDATE Messages SET is_read = 1 WHERE chat_id = ? AND sender_id != ?',
      [req.params.id, req.user.id]
    );
    res.json(msgs.map(m => ({ ...m, id: m.message_id, content: m.message_text })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat/rooms/:id/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message required' });

    const room = await qOne('SELECT * FROM Chats WHERE chat_id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.buyer_id !== req.user.id && room.seller_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const [r] = await pool.execute(
      "INSERT INTO Messages (chat_id, sender_id, message_text, is_read) VALUES (?, ?, ?, 0)",
      [req.params.id, req.user.id, content.trim()]
    );
    await pool.execute('UPDATE Chats SET last_message_at = NOW() WHERE chat_id = ?', [req.params.id]);

    const payload = {
      id: r.insertId,
      chat_id: Number(req.params.id),
      sender_id: req.user.id,
      sender_name: req.user.name,
      content: content.trim(),
      message_text: content.trim(),
      sent_at: new Date().toISOString(),
      is_read: 0,
      room_id: Number(req.params.id),
    };
    io.to(String(req.params.id)).emit('new_message', payload);

    const otherUserId = room.buyer_id === req.user.id ? room.seller_id : room.buyer_id;
    await pool.execute(
      "INSERT INTO Notifications (user_id, type, message, related_id) VALUES (?, 'message', ?, ?)",
      [otherUserId, `New message from ${req.user.name}: "${content.slice(0, 50)}"`, req.params.id]
    );
    res.status(201).json(payload);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ TRANSACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/transactions', auth, async (req, res) => {
  try {
    const { listing_id, payment_method, notes } = req.body;
    const listing = await qOne(
      `SELECT l.*, b.title, u.name AS seller_name, u.upi_id, u.upi_qr_image
       FROM Listings l
       JOIN Books b ON l.book_id = b.book_id
       JOIN Users u ON l.seller_id = u.user_id
       WHERE l.listing_id = ?`,
      [listing_id]
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id === req.user.id) return res.status(400).json({ error: 'Cannot buy your own listing' });
    if (!['online', 'both'].includes(listing.fulfillment_mode) || !listing.pdf_file_path)
      return res.status(400).json({ error: 'This listing is not available as an online PDF.' });

    const existing = await qOne(
      `SELECT transaction_id FROM Transactions
       WHERE listing_id=? AND buyer_id=? AND status IN ('pending','confirmed','completed')`,
      [listing_id, req.user.id]
    );
    if (existing) return res.json({ success: true, id: existing.transaction_id, already_requested: true });

    const [r] = await pool.execute(
      `INSERT INTO Transactions (listing_id, buyer_id, seller_id, transaction_type, agreed_price, payment_method, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [listing_id, req.user.id, listing.seller_id, listing.listing_type,
       listing.price || 0, payment_method || 'cash', notes || null]
    );
    await pool.execute(
      `INSERT INTO Notifications (user_id, type, title, message, related_id)
       VALUES (?, 'transaction', 'PDF purchase request', ?, ?)`,
      [listing.seller_id, `${req.user.name || 'A buyer'} requested online PDF access for "${listing.title}".`, r.insertId]
    );
    res.status(201).json({
      success: true,
      id: r.insertId,
      seller_payment: { seller_name: listing.seller_name, upi_id: listing.upi_id, upi_qr_image: listing.upi_qr_image }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/mine', auth, async (req, res) => {
  try {
    const rows = await qAll(
      `SELECT t.*, b.title, b.author, l.fulfillment_mode, l.pdf_original_name,
              buyer.name AS buyer_name, seller.name AS seller_name,
              seller.upi_id AS seller_upi_id, seller.upi_qr_image AS seller_upi_qr_image
       FROM Transactions t
       JOIN Listings l ON t.listing_id = l.listing_id
       JOIN Books b ON l.book_id = b.book_id
       JOIN Users buyer ON t.buyer_id = buyer.user_id
       JOIN Users seller ON t.seller_id = seller.user_id
       WHERE t.buyer_id = ? OR t.seller_id = ?
       ORDER BY t.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows.map(r => ({ ...r, id: r.transaction_id, role: r.buyer_id === req.user.id ? 'buyer' : 'seller' })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transactions/:id/approve-pdf', auth, async (req, res) => {
  try {
    const txn = await qOne(
      `SELECT t.*, l.pdf_file_path, b.title
       FROM Transactions t
       JOIN Listings l ON t.listing_id = l.listing_id
       JOIN Books b ON l.book_id = b.book_id
       WHERE t.transaction_id = ?`,
      [req.params.id]
    );
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.seller_id !== req.user.id) return res.status(403).json({ error: 'Only the seller can approve PDF access' });
    if (!txn.pdf_file_path) return res.status(400).json({ error: 'No PDF is attached to this listing' });

    await pool.execute(
      `UPDATE Transactions
       SET status='confirmed', confirmed_by_seller=1, pdf_access_granted=1, pdf_approved_at=NOW()
       WHERE transaction_id=?`,
      [req.params.id]
    );
    await pool.execute(
      `INSERT INTO Notifications (user_id, type, title, message, related_id)
       VALUES (?, 'transaction', 'PDF access approved', ?, ?)`,
      [txn.buyer_id, `Your PDF access for "${txn.title}" has been approved.`, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/:id/download', auth, async (req, res) => {
  try {
    const txn = await qOne(
      `SELECT t.*, l.pdf_file_path, l.pdf_original_name
       FROM Transactions t
       JOIN Listings l ON t.listing_id = l.listing_id
       WHERE t.transaction_id = ?`,
      [req.params.id]
    );
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    const isBuyer = txn.buyer_id === req.user.id;
    const isSeller = txn.seller_id === req.user.id;
    if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Forbidden' });
    if (isBuyer && !txn.pdf_access_granted) return res.status(403).json({ error: 'Seller has not approved PDF access yet' });
    if (!txn.pdf_file_path) return res.status(404).json({ error: 'No PDF file found' });

    const filePath = path.resolve(__dirname, txn.pdf_file_path);
    const safePdfDir = path.resolve(PDF_DIR);
    if (!filePath.startsWith(safePdfDir) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF file missing' });
    res.download(filePath, txn.pdf_original_name || 'book.pdf');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transactions/:id/complete', auth, async (req, res) => {
  try {
    const txn = await qOne('SELECT * FROM Transactions WHERE transaction_id = ?', [req.params.id]);
    if (!txn) return res.status(404).json({ error: 'Not found' });
    if (txn.seller_id !== req.user.id && txn.buyer_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });
    await pool.execute(
      "UPDATE Transactions SET status='completed', completed_at=NOW() WHERE transaction_id=?",
      [req.params.id]
    );
    await pool.execute(
      "UPDATE Listings SET status='sold', updated_at=NOW() WHERE listing_id=?",
      [txn.listing_id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ RATINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/ratings', auth, async (req, res) => {
  try {
    const { rated_user_id, score, review_text, transaction_id } = req.body;
    if (score < 1 || score > 5) return res.status(400).json({ error: 'Score must be 1-5' });
    const existing = await qOne(
      'SELECT rating_id FROM Ratings WHERE rater_id = ? AND rated_user_id = ? AND transaction_id = ?',
      [req.user.id, rated_user_id, transaction_id]
    );
    if (existing) return res.status(409).json({ error: 'Already rated this transaction' });
    await pool.execute(
      'INSERT INTO Ratings (transaction_id, rater_id, rated_user_id, score, review_text) VALUES (?, ?, ?, ?, ?)',
      [transaction_id, req.user.id, rated_user_id, score, review_text]
    );
    // Trust score is auto-updated by the MySQL trigger trg_update_trust_score
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ BOOK REVIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/books/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, review_text } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    const existing = await qOne('SELECT review_id FROM Book_Reviews WHERE book_id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    if (existing) return res.status(409).json({ error: 'Already reviewed this book' });
    const [r] = await pool.execute(
      'INSERT INTO Book_Reviews (book_id, user_id, rating, review_text) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, rating, review_text]
    );
    // Book rating auto-updated by trigger trg_update_book_rating
    res.status(201).json({ success: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ PRICE ALERTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/price-alerts', auth, async (req, res) => {
  try {
    const { book_id, target_price } = req.body;
    const existing = await qOne('SELECT alert_id FROM Price_Alerts WHERE user_id = ? AND book_id = ?',
      [req.user.id, book_id]);
    if (existing) {
      await pool.execute('UPDATE Price_Alerts SET target_price = ? WHERE alert_id = ?',
        [target_price, existing.alert_id]);
    } else {
      await pool.execute('INSERT INTO Price_Alerts (user_id, book_id, target_price) VALUES (?, ?, ?)',
        [req.user.id, book_id, target_price]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const notifs = await qAll(
      'SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(notifs.map(n => ({ ...n, id: n.notification_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/read-all', auth, async (req, res) => {
  try {
    await pool.execute('UPDATE Notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ BOOK REQUESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/book-requests', async (req, res) => {
  try {
    const reqs = await qAll(
      `SELECT br.*, u.name AS requester_name, u.department AS requester_dept
       FROM Book_Requests br JOIN Users u ON br.user_id = u.user_id
       WHERE br.status = 'open' ORDER BY br.created_at DESC LIMIT 50`
    );
    res.json(reqs.map(r => ({ ...r, id: r.request_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/book-requests', auth, async (req, res) => {
  try {
    const { title, author, subject, max_price, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const [r] = await pool.execute(
      'INSERT INTO Book_Requests (user_id, title, author, subject, max_price, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, title, author || null, subject || null, max_price || null, notes || null]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ READING GOALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/reading-goals', auth, async (req, res) => {
  try {
    const goals = await qAll('SELECT * FROM Reading_Goals WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(goals.map(g => ({ ...g, id: g.goal_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reading-goals', auth, async (req, res) => {
  try {
    const { title, target_date, notes } = req.body;
    const [r] = await pool.execute(
      "INSERT INTO Reading_Goals (user_id, title, target_date, notes, status) VALUES (?, ?, ?, ?, 'in_progress')",
      [req.user.id, title, target_date || null, notes || null]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/reading-goals/:id', auth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    await pool.execute(
      'UPDATE Reading_Goals SET status=?, notes=?, updated_at=NOW() WHERE goal_id=? AND user_id=?',
      [status, notes, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ PLATFORM STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await qOne(`
      SELECT
        (SELECT COUNT(*) FROM Listings WHERE status = 'active')       AS listings,
        (SELECT COUNT(*) FROM Users)                                   AS students,
        (SELECT COUNT(*) FROM Books)                                   AS books,
        IFNULL((SELECT SUM(agreed_price) * 0.4
                FROM Transactions WHERE status = 'completed'), 0)     AS estimated_savings
    `);
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ IMAGE UPLOAD (standalone) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/upload', auth, async (req, res) => {
  try {
    if (!req.files?.image) return res.status(400).json({ error: 'No image provided' });
    const file  = req.files.image;
    const fname = uuidv4() + path.extname(file.name);
    await file.mv(path.join(UPLOAD_DIR, fname));
    res.json({ url: '/uploads/' + fname });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â”€â”€â”€ SOCKET.IO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try { socket.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.user?.name}`);
  socket.on('join_room', (roomId) => socket.join(roomId));

  socket.on('send_message', async ({ room_id, content }) => {
    if (!content?.trim() || !room_id) return;
    try {
      const room = await qOne('SELECT * FROM Chats WHERE chat_id = ?', [room_id]);
      if (!room || (room.buyer_id !== socket.user.id && room.seller_id !== socket.user.id)) return;

      const [r] = await pool.execute(
        "INSERT INTO Messages (chat_id, sender_id, message_text, is_read) VALUES (?, ?, ?, 0)",
        [room_id, socket.user.id, content.trim()]
      );
      await pool.execute('UPDATE Chats SET last_message_at = NOW() WHERE chat_id = ?', [room_id]);

      const payload = { id: r.insertId, chat_id: room_id, sender_id: socket.user.id,
        sender_name: socket.user.name, content: content.trim(), message_text: content.trim(),
        sent_at: new Date().toISOString(), is_read: 0, room_id };
      io.to(room_id).emit('new_message', payload);

      // Notify the other user
      const otherUserId = room.buyer_id === socket.user.id ? room.seller_id : room.buyer_id;
      await pool.execute(
        "INSERT INTO Notifications (user_id, type, message, related_id) VALUES (?, 'message', ?, ?)",
        [otherUserId, `New message from ${socket.user.name}: "${content.slice(0, 50)}"`, room_id]
      );
    } catch (e) { console.error('Socket message error:', e.message); }
  });

  socket.on('typing', ({ room_id }) => socket.to(room_id).emit('typing', { sender: socket.user.name }));
  socket.on('disconnect', () => console.log(`Disconnected: ${socket.user?.name}`));
});

// â”€â”€â”€ SERVE FRONTEND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get(/.*/, (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// â”€â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
server.listen(PORT, async () => {
  try {
    await pool.execute('SELECT 1');
    console.log(`\nâœ… MySQL connected to ${process.env.DB_NAME || 'book_exchange_db'}`);
  } catch (e) {
    console.error('âŒ MySQL connection failed:', e.message);
    console.error('Frontend will still open, but database APIs need MySQL80 running and .env DB_PASSWORD set.');
  }
  console.log(`\nðŸš€ BookExchange server â†’ http://localhost:${PORT}`);
  console.log(`ðŸ“š API â†’ http://localhost:${PORT}/api`);
  console.log(`ðŸ” Health â†’ http://localhost:${PORT}/api/health\n`);
});



