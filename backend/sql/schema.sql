-- VistaraX - MySQL 8 / MariaDB 10.5+ schema (InnoDB, utf8mb4)
-- Safe to run repeatedly: every statement is CREATE ... IF NOT EXISTS.
-- Timestamps are stored in UTC. visit_date is a plain DATE (local business day).
-- NOTE: do not put semicolons inside comments - db.js splits this file on ";".

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'employee',
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  password_changed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_key VARCHAR(60) NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_key (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key VARCHAR(60) NOT NULL,
  permission_key VARCHAR(60) NOT NULL,
  PRIMARY KEY (role_key, permission_key),
  CONSTRAINT fk_roleperm_role FOREIGN KEY (role_key) REFERENCES roles(role_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS serial_counters (
  year INT NOT NULL,
  last_seq INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visitors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  serial_no VARCHAR(24) NOT NULL,
  name VARCHAR(150) NOT NULL,
  contact_no VARCHAR(20) NOT NULL,
  whatsapp_no VARCHAR(20) NULL,
  aadhaar_no VARCHAR(20) NULL,
  companions VARCHAR(300) NULL,
  whom_to_visit VARCHAR(150) NOT NULL,
  purpose VARCHAR(200) NULL,
  checkin_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  checkout_time DATETIME(3) NULL,
  photo_url VARCHAR(255) NULL,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  address VARCHAR(500) NULL,
  visit_date DATE NOT NULL,
  visit_day VARCHAR(20) NOT NULL,
  remarks VARCHAR(500) NULL,
  checkout_remarks VARCHAR(500) NULL,
  status ENUM('inside','checked_out') NOT NULL DEFAULT 'inside',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visitors_serial (serial_no),
  KEY idx_visitors_name (name),
  KEY idx_visitors_contact (contact_no),
  KEY idx_visitors_date (visit_date),
  KEY idx_visitors_status (status),
  CONSTRAINT fk_visitors_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  visitor_id INT UNSIGNED NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_read (is_read),
  CONSTRAINT fk_notif_visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT UNSIGNED NOT NULL,
  company_name VARCHAR(150) NOT NULL DEFAULT 'VistaraX',
  logo_url VARCHAR(255) NULL,
  address VARCHAR(500) NULL,
  contact VARCHAR(100) NULL,
  timezone VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
  date_format VARCHAR(30) NOT NULL DEFAULT 'DD MMM YYYY',
  photo_required TINYINT(1) NOT NULL DEFAULT 1,
  location_required TINYINT(1) NOT NULL DEFAULT 0,
  accent_color VARCHAR(30) NOT NULL DEFAULT 'blue',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  username VARCHAR(50) NULL,
  action VARCHAR(50) NOT NULL,
  module VARCHAR(40) NOT NULL,
  record_id VARCHAR(100) NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
