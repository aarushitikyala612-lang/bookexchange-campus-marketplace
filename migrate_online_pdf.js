require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'book_exchange_db',
  });

  const columns = [
    ['Users', 'upi_id', "ALTER TABLE Users ADD COLUMN upi_id VARCHAR(100) DEFAULT NULL"],
    ['Users', 'upi_qr_image', "ALTER TABLE Users ADD COLUMN upi_qr_image VARCHAR(255) DEFAULT NULL"],
    ['Listings', 'fulfillment_mode', "ALTER TABLE Listings ADD COLUMN fulfillment_mode ENUM('physical','online','both') DEFAULT 'physical' AFTER listing_type"],
    ['Listings', 'pdf_file_path', "ALTER TABLE Listings ADD COLUMN pdf_file_path VARCHAR(255) DEFAULT NULL AFTER cover_image_override"],
    ['Listings', 'pdf_original_name', "ALTER TABLE Listings ADD COLUMN pdf_original_name VARCHAR(255) DEFAULT NULL AFTER pdf_file_path"],
    ['Transactions', 'pdf_access_granted', "ALTER TABLE Transactions ADD COLUMN pdf_access_granted TINYINT(1) DEFAULT 0 AFTER confirmed_by_seller"],
    ['Transactions', 'pdf_approved_at', "ALTER TABLE Transactions ADD COLUMN pdf_approved_at DATETIME DEFAULT NULL AFTER pdf_access_granted"],
  ];

  for (const [tableName, columnName, statement] of columns) {
    const [existing] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    if (!existing.length) await db.query(statement);
  }
  await db.end();
  console.log('Online PDF migration complete');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
