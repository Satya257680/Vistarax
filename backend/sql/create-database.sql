-- Run once as a MySQL admin (root) - then put the same values in backend/.env
CREATE DATABASE IF NOT EXISTS vistarax CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED BY 'Satya@179';
-- Prefer 'localhost' instead of '%' when MySQL and the API run on the same server.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON vistarax.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
