# BookExchange project run notes

This project is a BookChor-style second-hand books marketplace for college students.

## Files
- `project1.js` - Express backend, MySQL connection, REST APIs, Socket.IO chat.
- `frontend/index.html` - frontend connected to backend APIs.
- `database_schema.sql` - MySQL database schema and sample data.
- `.env` - database connection settings.

## Run steps
1. Install MySQL Server and start it.
2. Open MySQL and run `C:\Users\aarus\OneDrive\Desktop\database_schema.sql`.
3. In this folder run: `npm.cmd install`
4. If you already had an older database, run: `node migrate_online_pdf.js`
5. Start backend: `npm.cmd start`
6. Open: `http://localhost:5000`

## Demo login
- Email: `arjun@vardhaman.ac.in`
- Password: `password123`

## What to show to faculty
- Frontend: home page, search filters, listing detail modal, login/register, post listing, wishlist, book requests, profile.
- Backend: `project1.js` routes under `/api/*`.
- Database: MySQL tables `Users`, `Books`, `Listings`, `Wishlists`, `Chats`, `Messages`, `Transactions`, `Ratings`, `Price_Alerts`, `Notifications`, `Book_Requests`, `Reading_Goals`.
- Health check: `http://localhost:5000/api/health` should return database connected.

## Online PDF sales
- Sellers can choose Physical, Online PDF, or both while posting a listing.
- Online listings require a PDF upload.
- Sellers should add UPI ID / UPI QR in Edit Profile.
- Buyers click "Buy PDF Online", pay using the seller UPI details, then wait for seller approval.
- Seller approves from Profile -> PDF Orders.
- Buyer can download the PDF from Profile -> PDF Orders after approval.
