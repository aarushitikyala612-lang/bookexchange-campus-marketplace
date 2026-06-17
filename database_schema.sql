-- ============================================================
--  BOOK EXCHANGE PLATFORM — Enhanced MySQL Database Schema
--  Vardhaman College of Engineering | CSE Summer Projects 2024-25
--  Project E-11 | Full-Stack Version 2.0
--
--  NEW TABLES vs Original:
--  ✅ Price_Alerts     — notify user when book hits target price
--  ✅ Notifications    — in-app notification system
--  ✅ Book_Requests    — community "I'm looking for" board
--  ✅ Reading_Goals    — track books you want to read
--  ✅ Book_Reviews     — review a book (separate from seller ratings)
--  ✅ Report_Listings  — report spam / scam listings
--  ✅ Saved_Searches   — save a search query for alerts
--  ✅ Promo_Codes      — discount codes for platform features
--
--  ENHANCED TABLES:
--  ✅ Users            — added branch, year, bio, social_links
--  ✅ Books            — added rating, total_reviews, views_count, tags (JSON)
--  ✅ Listings         — added featured flag, semester filter, location coords
--  ✅ Transactions     — added meetup_location, confirmed_by fields
-- ============================================================

CREATE DATABASE IF NOT EXISTS book_exchange_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE book_exchange_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Promo_Codes, Saved_Searches, Report_Listings, Book_Reviews, Reading_Goals,
  Notifications, Price_Alerts, AI_Recommendations, Subjects_Enrollment, Ratings, Transactions,
  Messages, Chats, Wishlists, Listings, Books, Users;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- TABLE 1: USERS  (enhanced)
-- ============================================================
CREATE TABLE Users (
    user_id         INT             AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    phone           VARCHAR(15)     DEFAULT NULL,
    college_name    VARCHAR(150)    DEFAULT 'Vardhaman College of Engineering',
    department      VARCHAR(100)    DEFAULT NULL,         -- CSE / ECE / MECH / CIVIL / EEE
    year            TINYINT         DEFAULT NULL,          -- 1–4
    bio             TEXT            DEFAULT NULL,
    profile_picture VARCHAR(255)    DEFAULT NULL,
    trust_score     DECIMAL(3,2)    DEFAULT 5.00,
    total_ratings   INT             DEFAULT 0,
    total_sales     INT             DEFAULT 0,            -- completed sale transactions
    total_exchanges INT             DEFAULT 0,            -- completed exchange transactions
    total_donations INT             DEFAULT 0,            -- books donated
    is_verified     TINYINT(1)      DEFAULT 0,
    is_banned       TINYINT(1)      DEFAULT 0,
    social_links    JSON            DEFAULT NULL,         -- {"instagram":"...", "linkedin":"..."}
    notification_prefs JSON         DEFAULT NULL,         -- {"email":true,"inapp":true}
    last_active_at  DATETIME        DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email   (email),
    INDEX idx_dept    (department),
    INDEX idx_trust   (trust_score DESC)
);

-- ============================================================
-- TABLE 2: BOOKS  (enhanced — community catalog)
-- ============================================================
CREATE TABLE Books (
    book_id         INT             AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(200)    NOT NULL,
    author          VARCHAR(150)    NOT NULL,
    isbn            VARCHAR(20)     DEFAULT NULL  UNIQUE,
    publisher       VARCHAR(150)    DEFAULT NULL,
    edition         VARCHAR(50)     DEFAULT NULL,
    year_published  YEAR            DEFAULT NULL,
    subject         VARCHAR(100)    NOT NULL,
    category        VARCHAR(100)    DEFAULT 'ALL',        -- CSE / ECE / MECH / ALL etc.
    semester        TINYINT         DEFAULT NULL,          -- 1–8
    cover_image     VARCHAR(255)    DEFAULT NULL,
    description     TEXT            DEFAULT NULL,
    tags            JSON            DEFAULT NULL,          -- ["algorithms","python","beginner"]
    rating          DECIMAL(3,2)    DEFAULT 0.00,          -- community book rating
    total_reviews   INT             DEFAULT 0,
    views_count     INT             DEFAULT 0,
    is_approved     TINYINT(1)      DEFAULT 1,             -- admin approves user-added books
    added_by        INT             DEFAULT NULL,          -- user_id who added it
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FULLTEXT INDEX ft_search (title, author, subject),
    INDEX idx_category_sem (category, semester),
    INDEX idx_rating       (rating DESC),
    FOREIGN KEY (added_by) REFERENCES Users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE 3: LISTINGS  (enhanced)
-- ============================================================
CREATE TABLE Listings (
    listing_id          INT             AUTO_INCREMENT PRIMARY KEY,
    seller_id           INT             NOT NULL,
    book_id             INT             NOT NULL,
    listing_type        ENUM('sale','exchange','donation') NOT NULL,
    price               DECIMAL(8,2)    DEFAULT NULL,
    negotiable          TINYINT(1)      DEFAULT 1,
    condition_rating    ENUM('Good','Fair','Poor')         NOT NULL,
    condition_notes     TEXT            DEFAULT NULL,
    photos              JSON            DEFAULT NULL,       -- array of image URLs
    cover_image_override VARCHAR(255)   DEFAULT NULL,      -- overrides book cover for this listing
    status              ENUM('active','sold','reserved','closed','flagged') DEFAULT 'active',
    preferred_exchange  VARCHAR(200)    DEFAULT NULL,
    location            VARCHAR(100)    DEFAULT NULL,       -- campus zone / hostel block
    location_lat        DECIMAL(10,8)   DEFAULT NULL,
    location_lng        DECIMAL(11,8)   DEFAULT NULL,
    is_featured         TINYINT(1)      DEFAULT 0,          -- promoted / featured listing
    views_count         INT             DEFAULT 0,
    save_count          INT             DEFAULT 0,
    created_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at          DATETIME        DEFAULT NULL,       -- auto-expire after 90 days

    FOREIGN KEY (seller_id) REFERENCES Users(user_id)  ON DELETE CASCADE,
    FOREIGN KEY (book_id)   REFERENCES Books(book_id)  ON DELETE CASCADE,

    INDEX idx_book_status   (book_id, status),
    INDEX idx_seller        (seller_id),
    INDEX idx_type_status   (listing_type, status),
    INDEX idx_price         (price),
    INDEX idx_created       (created_at DESC)
);

-- ============================================================
-- TABLE 4: WISHLISTS
-- ============================================================
CREATE TABLE Wishlists (
    wishlist_id         INT             AUTO_INCREMENT PRIMARY KEY,
    user_id             INT             NOT NULL,
    book_id             INT             NOT NULL,
    notify_available    TINYINT(1)      DEFAULT 1,
    notify_price_drop   TINYINT(1)      DEFAULT 0,
    max_price           DECIMAL(8,2)    DEFAULT NULL,       -- alert only if below this price
    added_at            DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_book (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)  ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Books(book_id)  ON DELETE CASCADE,
    INDEX idx_book (book_id)
);

-- ============================================================
-- TABLE 5: CHATS
-- ============================================================
CREATE TABLE Chats (
    chat_id         INT             AUTO_INCREMENT PRIMARY KEY,
    listing_id      INT             NOT NULL,
    buyer_id        INT             NOT NULL,
    seller_id       INT             NOT NULL,
    status          ENUM('active','closed','blocked') DEFAULT 'active',
    last_message_at DATETIME        DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_chat (listing_id, buyer_id),
    FOREIGN KEY (listing_id) REFERENCES Listings(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id)   REFERENCES Users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (seller_id)  REFERENCES Users(user_id)       ON DELETE CASCADE,

    INDEX idx_listing (listing_id),
    INDEX idx_buyer   (buyer_id),
    INDEX idx_seller  (seller_id)
);

-- ============================================================
-- TABLE 6: MESSAGES
-- ============================================================
CREATE TABLE Messages (
    message_id      INT             AUTO_INCREMENT PRIMARY KEY,
    chat_id         INT             NOT NULL,
    sender_id       INT             NOT NULL,
    message_text    TEXT            NOT NULL,
    message_type    ENUM('text','image','offer','system') DEFAULT 'text',
    offer_price     DECIMAL(8,2)    DEFAULT NULL,          -- for price-offer messages
    is_read         TINYINT(1)      DEFAULT 0,
    sent_at         DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (chat_id)   REFERENCES Chats(chat_id)   ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id)   ON DELETE CASCADE,
    INDEX idx_chat_time (chat_id, sent_at)
);

-- ============================================================
-- TABLE 7: TRANSACTIONS  (enhanced)
-- ============================================================
CREATE TABLE Transactions (
    transaction_id      INT             AUTO_INCREMENT PRIMARY KEY,
    listing_id          INT             NOT NULL,
    buyer_id            INT             NOT NULL,
    seller_id           INT             NOT NULL,
    transaction_type    ENUM('sale','exchange','donation') NOT NULL,
    agreed_price        DECIMAL(8,2)    DEFAULT 0.00,
    payment_method      ENUM('cash','upi','bank_transfer','free') DEFAULT 'cash',
    meetup_location     VARCHAR(200)    DEFAULT NULL,       -- NEW: where they met
    meetup_time         DATETIME        DEFAULT NULL,       -- NEW: when they met
    status              ENUM('pending','confirmed','completed','disputed','cancelled') DEFAULT 'pending',
    confirmed_by_buyer  TINYINT(1)      DEFAULT 0,          -- NEW: dual confirmation
    confirmed_by_seller TINYINT(1)      DEFAULT 0,
    completed_at        DATETIME        DEFAULT NULL,
    notes               TEXT            DEFAULT NULL,
    created_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (listing_id) REFERENCES Listings(listing_id) ON DELETE RESTRICT,
    FOREIGN KEY (buyer_id)   REFERENCES Users(user_id)       ON DELETE RESTRICT,
    FOREIGN KEY (seller_id)  REFERENCES Users(user_id)       ON DELETE RESTRICT,

    INDEX idx_buyer_seller (buyer_id, seller_id),
    INDEX idx_status       (status)
);

-- ============================================================
-- TABLE 8: RATINGS  (user-to-user after transaction)
-- ============================================================
CREATE TABLE Ratings (
    rating_id       INT             AUTO_INCREMENT PRIMARY KEY,
    transaction_id  INT             NOT NULL,
    rater_id        INT             NOT NULL,
    rated_user_id   INT             NOT NULL,
    score           TINYINT         NOT NULL CHECK (score BETWEEN 1 AND 5),
    review_text     TEXT            DEFAULT NULL,
    tags            JSON            DEFAULT NULL,           -- ["quick response","good condition","honest"]
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_one_rating (transaction_id, rater_id),
    FOREIGN KEY (transaction_id) REFERENCES Transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (rater_id)       REFERENCES Users(user_id)               ON DELETE CASCADE,
    FOREIGN KEY (rated_user_id)  REFERENCES Users(user_id)               ON DELETE CASCADE,

    INDEX idx_rated_user (rated_user_id)
);

-- ============================================================
-- TABLE 9: BOOK_REVIEWS  ★ NEW — review the book itself
-- ============================================================
CREATE TABLE Book_Reviews (
    review_id       INT             AUTO_INCREMENT PRIMARY KEY,
    book_id         INT             NOT NULL,
    user_id         INT             NOT NULL,
    rating          TINYINT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text     TEXT            DEFAULT NULL,
    is_helpful_count INT            DEFAULT 0,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_book_review (book_id, user_id),
    FOREIGN KEY (book_id) REFERENCES Books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,

    INDEX idx_book  (book_id)
);

-- ============================================================
-- TABLE 10: PRICE_ALERTS  ★ NEW — alert when price drops
-- ============================================================
CREATE TABLE Price_Alerts (
    alert_id        INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    book_id         INT             NOT NULL,
    target_price    DECIMAL(8,2)    NOT NULL,
    is_triggered    TINYINT(1)      DEFAULT 0,
    triggered_at    DATETIME        DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_book_alert (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Books(book_id) ON DELETE CASCADE,

    INDEX idx_book_price (book_id, target_price)
);

-- ============================================================
-- TABLE 11: NOTIFICATIONS  ★ NEW — in-app notification feed
-- ============================================================
CREATE TABLE Notifications (
    notification_id INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    type            ENUM('message','wishlist_available','price_alert','transaction',
                         'rating_received','system','book_request') NOT NULL,
    title           VARCHAR(150)    DEFAULT NULL,
    message         TEXT            NOT NULL,
    link_url        VARCHAR(255)    DEFAULT NULL,
    related_id      INT             DEFAULT NULL,           -- listing_id / chat_id etc.
    is_read         TINYINT(1)      DEFAULT 0,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read),
    INDEX idx_created     (created_at DESC)
);

-- ============================================================
-- TABLE 12: BOOK_REQUESTS  ★ NEW — community "looking for" board
-- ============================================================
CREATE TABLE Book_Requests (
    request_id      INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    author          VARCHAR(150)    DEFAULT NULL,
    subject         VARCHAR(100)    DEFAULT NULL,
    max_price       DECIMAL(8,2)    DEFAULT NULL,
    notes           TEXT            DEFAULT NULL,
    status          ENUM('open','fulfilled','cancelled') DEFAULT 'open',
    fulfilled_by    INT             DEFAULT NULL,           -- listing_id that fulfilled it
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME        DEFAULT NULL,

    FOREIGN KEY (user_id)      REFERENCES Users(user_id)    ON DELETE CASCADE,
    FOREIGN KEY (fulfilled_by) REFERENCES Listings(listing_id) ON DELETE SET NULL,

    INDEX idx_user   (user_id),
    INDEX idx_status (status),
    FULLTEXT INDEX ft_request (title, subject)
);

-- ============================================================
-- TABLE 13: READING_GOALS  ★ NEW — personal reading tracker
-- ============================================================
CREATE TABLE Reading_Goals (
    goal_id         INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    book_id         INT             DEFAULT NULL,           -- optionally link to catalog book
    title           VARCHAR(200)    NOT NULL,               -- custom title or book title
    target_date     DATE            DEFAULT NULL,
    completed_date  DATE            DEFAULT NULL,
    status          ENUM('in_progress','completed','abandoned') DEFAULT 'in_progress',
    notes           TEXT            DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Books(book_id) ON DELETE SET NULL,
    INDEX idx_user_status (user_id, status)
);

-- ============================================================
-- TABLE 14: REPORT_LISTINGS  ★ NEW — flag spam/scam/misleading
-- ============================================================
CREATE TABLE Report_Listings (
    report_id       INT             AUTO_INCREMENT PRIMARY KEY,
    listing_id      INT             NOT NULL,
    reporter_id     INT             NOT NULL,
    reason          ENUM('spam','misleading','wrong_condition','scam','duplicate','other') NOT NULL,
    details         TEXT            DEFAULT NULL,
    status          ENUM('pending','reviewed','dismissed','action_taken') DEFAULT 'pending',
    reviewed_at     DATETIME        DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_report (listing_id, reporter_id),
    FOREIGN KEY (listing_id)   REFERENCES Listings(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id)  REFERENCES Users(user_id)       ON DELETE CASCADE
);

-- ============================================================
-- TABLE 15: SAVED_SEARCHES  ★ NEW — save search + get alerts
-- ============================================================
CREATE TABLE Saved_Searches (
    search_id       INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    query           VARCHAR(200)    NOT NULL,
    filters         JSON            DEFAULT NULL,           -- {category, condition, max_price}
    notify_new      TINYINT(1)      DEFAULT 1,
    last_notified   DATETIME        DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- ============================================================
-- TABLE 16: SUBJECTS_ENROLLMENT  (used by AI recommendation model)
-- ============================================================
CREATE TABLE Subjects_Enrollment (
    enrollment_id   INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    subject_name    VARCHAR(100)    NOT NULL,
    semester        VARCHAR(20)     DEFAULT NULL,
    added_at        DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- ============================================================
-- TABLE 17: AI_RECOMMENDATIONS
-- ============================================================
CREATE TABLE AI_Recommendations (
    recommendation_id       INT             AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT             NOT NULL,
    book_id                 INT             NOT NULL,
    recommendation_score    DECIMAL(5,4)    NOT NULL,
    reason                  VARCHAR(255)    DEFAULT NULL,
    based_on_subjects       JSON            DEFAULT NULL,
    is_dismissed            TINYINT(1)      DEFAULT 0,
    generated_at            DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Books(book_id) ON DELETE CASCADE,

    INDEX idx_user_score (user_id, recommendation_score DESC)
);

-- ============================================================
-- VIEWS  (pre-built queries for common use-cases)
-- ============================================================

-- Active listings with full book + seller info
CREATE OR REPLACE VIEW vw_active_listings AS
SELECT
    l.listing_id, l.listing_type, l.price, l.negotiable,
    l.condition_rating, l.condition_notes, l.status,
    l.views_count, l.created_at,
    b.book_id, b.title, b.author, b.subject, b.category,
    b.semester, b.cover_image, b.isbn, b.rating AS book_rating,
    u.user_id AS seller_id, u.name AS seller_name,
    u.trust_score, u.total_ratings, u.department AS seller_dept
FROM Listings l
JOIN Books  b ON l.book_id   = b.book_id
JOIN Users  u ON l.seller_id = u.user_id
WHERE l.status = 'active';

-- Unread notifications per user
CREATE OR REPLACE VIEW vw_unread_notif_count AS
SELECT user_id, COUNT(*) AS unread_count
FROM Notifications
WHERE is_read = 0
GROUP BY user_id;

-- User stats summary
CREATE OR REPLACE VIEW vw_user_stats AS
SELECT
    u.user_id, u.name, u.email, u.department, u.trust_score,
    u.total_ratings,
    COUNT(DISTINCT l.listing_id)     AS total_listings,
    COUNT(DISTINCT t.transaction_id) AS total_transactions,
    COUNT(DISTINCT w.wishlist_id)    AS wishlist_count,
    COUNT(DISTINCT g.goal_id)        AS reading_goals
FROM Users u
LEFT JOIN Listings       l ON l.seller_id = u.user_id
LEFT JOIN Transactions   t ON t.seller_id = u.user_id OR t.buyer_id = u.user_id
LEFT JOIN Wishlists      w ON w.user_id   = u.user_id
LEFT JOIN Reading_Goals  g ON g.user_id   = u.user_id
GROUP BY u.user_id;

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER //

-- Auto-update trust_score when new Rating is added
CREATE TRIGGER trg_update_trust_score
AFTER INSERT ON Ratings
FOR EACH ROW
BEGIN
    UPDATE Users
    SET
        trust_score   = (SELECT ROUND(AVG(score),2) FROM Ratings WHERE rated_user_id = NEW.rated_user_id),
        total_ratings = (SELECT COUNT(*) FROM Ratings WHERE rated_user_id = NEW.rated_user_id)
    WHERE user_id = NEW.rated_user_id;
END;
//

-- Auto-update book rating when a Book_Review is inserted
CREATE TRIGGER trg_update_book_rating
AFTER INSERT ON Book_Reviews
FOR EACH ROW
BEGIN
    UPDATE Books
    SET
        rating       = (SELECT ROUND(AVG(rating),2) FROM Book_Reviews WHERE book_id = NEW.book_id),
        total_reviews= (SELECT COUNT(*) FROM Book_Reviews WHERE book_id = NEW.book_id)
    WHERE book_id = NEW.book_id;
END;
//

-- Close listing when transaction is completed
CREATE TRIGGER trg_close_listing_on_complete
AFTER UPDATE ON Transactions
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE Listings SET status = 'sold', updated_at = NOW()
        WHERE listing_id = NEW.listing_id;

        -- Increment seller's total_sales / total_donations / total_exchanges
        IF NEW.transaction_type = 'sale' THEN
            UPDATE Users SET total_sales = total_sales + 1 WHERE user_id = NEW.seller_id;
        ELSEIF NEW.transaction_type = 'exchange' THEN
            UPDATE Users SET total_exchanges = total_exchanges + 1 WHERE user_id = NEW.seller_id;
        ELSEIF NEW.transaction_type = 'donation' THEN
            UPDATE Users SET total_donations = total_donations + 1 WHERE user_id = NEW.seller_id;
        END IF;
    END IF;
END;
//

-- Auto-set transaction to confirmed when BOTH parties confirm
CREATE TRIGGER trg_auto_confirm_transaction
AFTER UPDATE ON Transactions
FOR EACH ROW
BEGIN
    IF NEW.confirmed_by_buyer = 1 AND NEW.confirmed_by_seller = 1
       AND NEW.status = 'pending' THEN
        UPDATE Transactions
        SET status = 'completed', completed_at = NOW()
        WHERE transaction_id = NEW.transaction_id;
    END IF;
END;
//

-- Trigger notification when a wishlisted book gets a new listing
CREATE TRIGGER trg_notify_wishlist_on_new_listing
AFTER INSERT ON Listings
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE wUserId INT;
    DECLARE cur CURSOR FOR
        SELECT user_id FROM Wishlists
        WHERE book_id = NEW.book_id AND notify_available = 1 AND user_id != NEW.seller_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO wUserId;
        IF done THEN LEAVE read_loop; END IF;
        INSERT INTO Notifications (user_id, type, message, related_id)
        SELECT wUserId, 'wishlist_available',
               CONCAT('Good news! "', b.title, '" you wishlisted is now available.'),
               NEW.listing_id
        FROM Books b WHERE b.book_id = NEW.book_id;
    END LOOP;
    CLOSE cur;
END;
//

-- Auto-expire listings after 90 days
CREATE EVENT IF NOT EXISTS evt_expire_old_listings
ON SCHEDULE EVERY 1 DAY
DO
    UPDATE Listings
    SET status = 'closed', updated_at = NOW()
    WHERE status = 'active'
      AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
//

DELIMITER ;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER //

-- Search listings (replaces complex query in app)
CREATE PROCEDURE sp_search_listings(
    IN p_search     VARCHAR(200),
    IN p_category   VARCHAR(50),
    IN p_condition  VARCHAR(10),
    IN p_type       VARCHAR(20),
    IN p_min_price  DECIMAL(8,2),
    IN p_max_price  DECIMAL(8,2),
    IN p_semester   TINYINT,
    IN p_sort       VARCHAR(20),
    IN p_limit      INT,
    IN p_offset     INT
)
BEGIN
    SELECT
        l.listing_id, l.listing_type, l.price, l.condition_rating,
        l.status, l.views_count, l.created_at, l.cover_image_override,
        b.book_id, b.title, b.author, b.subject, b.category, b.semester,
        b.cover_image, b.isbn, b.rating AS book_rating,
        u.user_id AS seller_id, u.name AS seller_name,
        u.trust_score, u.department
    FROM Listings l
    JOIN Books b ON l.book_id   = b.book_id
    JOIN Users u ON l.seller_id = u.user_id
    WHERE l.status = 'active'
      AND (p_search   IS NULL OR p_search = '' OR MATCH(b.title,b.author,b.subject) AGAINST(p_search IN BOOLEAN MODE))
      AND (p_category IS NULL OR p_category = '' OR b.category = p_category)
      AND (p_condition IS NULL OR p_condition = '' OR l.condition_rating = p_condition)
      AND (p_type     IS NULL OR p_type = '' OR l.listing_type = p_type)
      AND (p_min_price IS NULL OR l.price >= p_min_price)
      AND (p_max_price IS NULL OR l.price <= p_max_price)
      AND (p_semester IS NULL OR b.semester = p_semester)
    ORDER BY
        CASE WHEN p_sort = 'price_asc'  THEN l.price  END ASC,
        CASE WHEN p_sort = 'price_desc' THEN l.price  END DESC,
        CASE WHEN p_sort = 'rating'     THEN u.trust_score END DESC,
        l.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
//

-- Get complete profile for a user
CREATE PROCEDURE sp_get_user_profile(IN p_user_id INT)
BEGIN
    -- Basic info
    SELECT u.*,
           (SELECT COUNT(*) FROM Listings   WHERE seller_id = p_user_id AND status='active') AS active_listings,
           (SELECT COUNT(*) FROM Transactions WHERE (buyer_id=p_user_id OR seller_id=p_user_id) AND status='completed') AS completed_deals
    FROM Users u WHERE u.user_id = p_user_id;

    -- Active listings
    SELECT l.listing_id, l.listing_type, l.price, l.condition_rating, l.status, l.created_at,
           b.title, b.author, b.subject, b.cover_image
    FROM Listings l JOIN Books b ON l.book_id = b.book_id
    WHERE l.seller_id = p_user_id ORDER BY l.created_at DESC LIMIT 20;

    -- Recent ratings received
    SELECT r.score, r.review_text, r.created_at,
           u.name AS rater_name
    FROM Ratings r JOIN Users u ON r.rater_id = u.user_id
    WHERE r.rated_user_id = p_user_id ORDER BY r.created_at DESC LIMIT 10;
END;
//

DELIMITER ;

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO Users (name, email, password_hash, phone, department, year, bio, trust_score, total_ratings, is_verified) VALUES
('Arjun Sharma',   'arjun@vardhaman.ac.in',  '$2b$10$xSampleHash1', '9876543210', 'CSE',   3, 'CSE 3rd year | Love sharing books!',   4.8, 24, 1),
('Priya Reddy',    'priya@vardhaman.ac.in',   '$2b$10$xSampleHash2', '9876543211', 'ECE',   2, 'ECE student | Always buying textbooks', 4.5, 12, 1),
('Rahul Verma',    'rahul@vardhaman.ac.in',   '$2b$10$xSampleHash3', '9876543212', 'MECH',  4, 'Final year — selling everything!',      4.9, 38, 1),
('Sneha Patel',    'sneha@vardhaman.ac.in',   '$2b$10$xSampleHash4', '9876543213', 'CIVIL', 2, 'Looking for CIVIL books',               4.2,  8, 0),
('Mohammed Irfan', 'irfan@vardhaman.ac.in',   '$2b$10$xSampleHash5', '9876543214', 'EEE',   3, 'EEE | happy to exchange',               4.6, 16, 1);

INSERT INTO Books (title, author, isbn, subject, category, semester, publisher, year_published, description, cover_image, rating, total_reviews) VALUES
('Data Structures and Algorithms in Python', 'Michael T. Goodrich', '9781118290279', 'Data Structures', 'CSE', 3, 'Wiley', 2013, 'Comprehensive introduction to data structures using Python.', 'https://covers.openlibrary.org/b/isbn/9781118290279-L.jpg', 4.5, 234),
('Introduction to Algorithms (CLRS)',        'Thomas H. Cormen',    '9780262033848', 'Algorithms',       'CSE', 4, 'MIT Press', 2009, 'The definitive textbook on algorithms — CLRS.',             'https://covers.openlibrary.org/b/isbn/9780262033848-L.jpg', 4.8, 512),
('Database System Concepts',                 'Abraham Silberschatz', '9780073523323', 'Database Mgmt',   'CSE', 5, 'McGraw Hill', 2011, 'Complete coverage of database system concepts.',          'https://covers.openlibrary.org/b/isbn/9780073523323-L.jpg', 4.3, 189),
('Operating System Concepts',                'Abraham Silberschatz', '9781118063330', 'Operating Systems','CSE', 5, 'Wiley', 2012, 'The "Dinosaur Book" — standard OS textbook.',               'https://covers.openlibrary.org/b/isbn/9781118063330-L.jpg', 4.6, 445),
('Engineering Mathematics',                  'B.S. Grewal',         '9789385551185', 'Mathematics',     'ALL', 1, 'Khanna Publishers', 2016, 'Standard engineering maths textbook.',                   'https://covers.openlibrary.org/b/isbn/9789385551185-L.jpg', 4.7, 1200),
('Signals and Systems',                      'Alan V. Oppenheim',   '9780138147570', 'Signals & Systems','ECE', 4, 'Prentice Hall', 1996, 'Classic signals and systems textbook.',                   'https://covers.openlibrary.org/b/isbn/9780138147570-L.jpg', 4.5, 388),
('Strength of Materials',                    'R.K. Bansal',         '9788177005578', 'Strength of Materials','MECH',3, 'Laxmi Publications', 2018, 'Comprehensive strength of materials.',              'https://covers.openlibrary.org/b/isbn/9788177005578-L.jpg', 4.2, 276),
('Artificial Intelligence: A Modern Approach','Stuart Russell',     '9780136042594', 'Artificial Intelligence','CSE',7,'Prentice Hall',2009,'The most comprehensive AI textbook.',             'https://covers.openlibrary.org/b/isbn/9780136042594-L.jpg', 4.9, 678);

INSERT INTO Listings (seller_id, book_id, listing_type, price, condition_rating, condition_notes, status) VALUES
(1, 1, 'sale',     280, 'Good', 'Barely used, no highlighting.',             'active'),
(2, 2, 'sale',     450, 'Good', 'Some pencil marks, easily erasable.',       'active'),
(3, 5, 'donation', NULL,'Fair', 'Some wear but fully readable.',             'active'),
(4, 3, 'exchange', NULL,'Good', 'Looking to exchange for Networking/OS.',    'active'),
(5, 6, 'sale',     320, 'Good', 'Very good condition, original price ₹650.', 'active'),
(1, 4, 'sale',     390, 'Fair', 'Some highlighting but all content visible.','active'),
(2, 7, 'exchange', NULL,'Fair', 'Exchange for Fluid Mechanics.',             'active'),
(3, 8, 'sale',     520, 'Good', 'Mint condition, moving to digital.',        'active');

-- ============================================================
-- USEFUL QUERIES (commented reference)
-- ============================================================

-- 1. Full-text search listings
-- CALL sp_search_listings('data structures', 'CSE', 'Good', 'sale', NULL, 500, NULL, 'price_asc', 20, 0);

-- 2. Get wishlist with availability for user
-- SELECT b.title, b.author, w.max_price,
--        COUNT(l.listing_id) AS available_count,
--        MIN(l.price) AS lowest_price
-- FROM Wishlists w
-- JOIN Books b ON w.book_id = b.book_id
-- LEFT JOIN Listings l ON l.book_id = b.book_id AND l.status='active'
-- WHERE w.user_id = 1
-- GROUP BY w.wishlist_id;

-- 3. Books with price below user's alert
-- SELECT b.title, l.price, pa.target_price, u.name AS seller
-- FROM Price_Alerts pa
-- JOIN Books b ON pa.book_id = b.book_id
-- JOIN Listings l ON l.book_id = b.book_id AND l.status='active' AND l.price <= pa.target_price
-- JOIN Users u ON l.seller_id = u.user_id
-- WHERE pa.user_id = 1 AND pa.is_triggered = 0;

-- 4. Unread messages per chat
-- SELECT c.chat_id, COUNT(m.message_id) AS unread
-- FROM Chats c JOIN Messages m ON m.chat_id=c.chat_id
-- WHERE (c.buyer_id=1 OR c.seller_id=1) AND m.sender_id!=1 AND m.is_read=0
-- GROUP BY c.chat_id;

-- 5. Trending books this week
-- SELECT b.title, b.author, COUNT(l.listing_id) AS listing_count, MIN(l.price) AS lowest_price
-- FROM Books b JOIN Listings l ON l.book_id=b.book_id
-- WHERE l.status='active' AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
-- GROUP BY b.book_id ORDER BY listing_count DESC LIMIT 10;

-- 6. Platform stats
-- SELECT
--   (SELECT COUNT(*) FROM Listings WHERE status='active') AS active_listings,
--   (SELECT COUNT(*) FROM Users)                          AS total_users,
--   (SELECT COUNT(*) FROM Transactions WHERE status='completed') AS completed_deals,
--   (SELECT SUM(agreed_price)*0.4 FROM Transactions WHERE status='completed') AS estimated_savings;
