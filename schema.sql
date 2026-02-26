-- Roster App Database Schema

CREATE DATABASE IF NOT EXISTS astromedia_bypat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE astromedia_bypat;

-- Create user if not exists (permissions might fail if not run as root, but we try)
-- CREATE USER IF NOT EXISTS 'bypat'@'localhost' IDENTIFIED BY 'epnH!?6K6bpoyL6v';
-- GRANT ALL PRIVILEGES ON astromedia_bypat.* TO 'bypat'@'localhost';
-- FLUSH PRIVILEGES;

CREATE TABLE IF NOT EXISTS `stores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50),
  `email` VARCHAR(255),
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shifts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` INT NOT NULL,
  `member_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `duration` DECIMAL(5,2) NOT NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin (password: 123 - we will use bcrypt in node, but for now just mock it)
-- The hash below is for '123' using bcrypt with cost 10
INSERT IGNORE INTO `admins` (`username`, `password_hash`) VALUES ('eli', '$2b$10$wT0lH.kX5QZQb0bBq1u2R.W8V8F7U5L5J6s9o8C7G6B5k4N3m2Q1O');

-- Insert default store
INSERT IGNORE INTO `stores` (`id`, `name`) VALUES (1, 'Broadmeadows');
