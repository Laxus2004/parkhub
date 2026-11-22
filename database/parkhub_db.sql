-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 21, 2026 at 04:30 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `parkhub_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('superadmin','staff','driver') NOT NULL DEFAULT 'driver',
  `display_name` varchar(100) NOT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `contact` varchar(20) DEFAULT NULL,
  `facility_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`username`, `password`, `role`, `display_name`, `first_name`, `last_name`, `email`, `contact`, `facility_id`, `created_at`) VALUES
('admin', '$2y$10$kP0VEGWYp3fhN600tESYGOocbnbS07MvoLaHq05BjG20mkAS5YoHe', 'superadmin', 'Super Admin', NULL, NULL, NULL, NULL, NULL, '2026-11-21 09:20:01'),
('jappy', '$2y$10$kXnFkeJXXarJeYCkHu5rWeeLMbnDzdF1e6Y2lE.KyqXaeJZehm2d.', 'driver', 'Jaspher Arnado', 'Jaspher', 'Arnado', 'godlike20156@gmail.com', '09346067995', NULL, '2026-11-21 14:04:59'),
('staff1', '$2y$10$d.HVY/pPZ3.iYPt7n8w1PeXLBhLhhYKZ6E9iHrMbo6rT2/u8eUXAG', 'staff', 'Staff 1', NULL, NULL, NULL, NULL, 'fac-sanciangko', '2026-11-21 09:20:01'),
('staff2', '$2y$10$nvuhevVrkdltaIiCwzKaFOUv6QTXrJAVOVoPF8eKbAm3VLbnM7tc.', 'staff', 'Staff 2', NULL, NULL, NULL, NULL, 'fac-plaza-independencia', '2026-11-21 09:20:01'),
('vintoy', '$2y$10$giWHNfEeZivlG9JXFsiuqOjZEZW8/TDFpFPamG3rnzC1kGiq0z84K', 'driver', 'Vintoy', 'Vintoy', '', 'vintoy123@gmail.com', '09123456789', NULL, '2026-11-21 09:20:01');

-- --------------------------------------------------------

--
-- Table structure for table `damage_reports`
--

CREATE TABLE `damage_reports` (
  `id` varchar(30) NOT NULL,
  `slot_id` varchar(10) NOT NULL,
  `facility_name` varchar(100) NOT NULL,
  `reported_by` varchar(100) NOT NULL,
  `timestamp` bigint(20) NOT NULL,
  `resolved` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `damage_reports`
--

INSERT INTO `damage_reports` (`id`, `slot_id`, `facility_name`, `reported_by`, `timestamp`, `resolved`) VALUES
('2053dc82', 'A-08', 'Sanciangko Parking Plaza', 'Staff 1', 1795269835823, 1),
('seed-B-03', 'B-03', 'Sanciangko Parking Plaza', 'System', 1795267777414, 1),
('seed-C-08', 'C-08', 'Sanciangko Parking Plaza', 'System', 1795267777414, 1),
('seed-F-07', 'F-07', 'Plaza Independencia Parking', 'System', 1795267777414, 1),
('seed-G-04', 'G-04', 'Plaza Independencia Parking', 'System', 1795267777414, 1);

-- --------------------------------------------------------

--
-- Table structure for table `facilities`
--

CREATE TABLE `facilities` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `address` varchar(255) NOT NULL,
  `distance_km` decimal(5,2) DEFAULT NULL,
  `total_slots` int(11) NOT NULL DEFAULT 0,
  `rate_per_hour` decimal(10,2) NOT NULL DEFAULT 50.00,
  `motorcycle_rate` decimal(10,2) NOT NULL DEFAULT 30.00,
  `hours` varchar(100) NOT NULL,
  `zones` varchar(100) NOT NULL,
  `photo` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `facilities`
--

INSERT INTO `facilities` (`id`, `name`, `address`, `distance_km`, `total_slots`, `rate_per_hour`, `motorcycle_rate`, `hours`, `zones`, `photo`) VALUES
('fac-plaza-independencia', 'Plaza Independencia Parking', 'Plaza Independencia, Cebu City', 1.10, 40, 50.00, 30.00, '24/7', 'D,E,F,G', 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&h=600&fit=crop&auto=format'),
('fac-sanciangko', 'Sanciangko Parking Plaza', 'Sanciangko St., Cebu City', 0.60, 40, 50.00, 30.00, '24/7', 'A,B,C,D', 'https://images.unsplash.com/photo-1470224114660-3f6686c562eb?w=800&h=600&fit=crop&auto=format');

-- --------------------------------------------------------

--
-- Table structure for table `fired_alerts`
--

CREATE TABLE `fired_alerts` (
  `username` varchar(50) NOT NULL,
  `alert_key` varchar(50) NOT NULL,
  `flag` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `fired_alerts`
--

INSERT INTO `fired_alerts` (`username`, `alert_key`, `flag`) VALUES
('vintoy', 'res:RSV-007', 'arrival'),
('vintoy', 'res:RSV-007', 'overdue'),
('vintoy', 'res:RSV-008', 'overdue');

-- --------------------------------------------------------

--
-- Table structure for table `history`
--

CREATE TABLE `history` (
  `id` varchar(20) NOT NULL,
  `account_username` varchar(50) DEFAULT NULL,
  `plate` varchar(20) NOT NULL,
  `vehicle` enum('Automobile','Motorcycle') NOT NULL,
  `driver` varchar(100) NOT NULL DEFAULT 'Walk-in',
  `slot` varchar(10) NOT NULL,
  `entry` bigint(20) NOT NULL,
  `duration` int(11) DEFAULT NULL,
  `reservation_id` varchar(20) DEFAULT NULL,
  `exit` bigint(20) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `history`
--

INSERT INTO `history` (`id`, `account_username`, `plate`, `vehicle`, `driver`, `slot`, `entry`, `duration`, `reservation_id`, `exit`, `amount`, `paid`) VALUES
('TCK-20512', NULL, '123 GGAG', 'Motorcycle', 'Jaspher Arnado', 'C-10', 1795269341672, NULL, NULL, 1795274702293, 60.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(20) NOT NULL,
  `username` varchar(50) NOT NULL,
  `type` varchar(30) NOT NULL,
  `title` varchar(150) NOT NULL,
  `body` text NOT NULL,
  `reservation_id` varchar(20) DEFAULT NULL,
  `timestamp` bigint(20) NOT NULL,
  `read` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `username`, `type`, `title`, `body`, `reservation_id`, `timestamp`, `read`) VALUES
('69473500', 'vintoy', 'overdue', 'Reservation Overdue — Missed Arrival', 'You missed your arrival time for slot A-05 (RSV-008). Your 2-hour reservation window is still active and expires at 1:07 AM.', 'RSV-008', 1795273689406, 1),
('6ba47775', 'vintoy', 'approval', 'Parking Extended', 'Slot A-03 (TCK-20511) extended by 1h. New expiry: 1:37 AM.', NULL, 1795268280140, 1),
('d1fa8f2d', 'vintoy', 'approval', 'Reservation Approved', 'Your reservation RSV-006 for slot A-01 has been approved by staff. You are now checked in — welcome to Sanciangko Parking Plaza!', 'RSV-006', 1795269741056, 1),
('d418d283', 'vintoy', 'reminder', 'Parking Reminder — 20 Minutes', 'Your reserved slot D-04 (RSV-007) is due at 11:10 PM. Please head to the facility now.', 'RSV-007', 1795273459857, 1),
('d81f832b', 'vintoy', 'overdue', 'Reservation Overdue — Missed Arrival', 'You missed your arrival time for slot D-04 (RSV-007). Your 4-hour reservation window is still active and expires at 3:10 AM.', 'RSV-007', 1795273811478, 1),
('dfc60c60', 'vintoy', 'approval', 'Reservation Approved', 'Your reservation RSV-005 for slot A-03 has been approved by staff. You are now checked in — welcome to Sanciangko Parking Plaza!', 'RSV-005', 1795268259092, 1);

-- --------------------------------------------------------

--
-- Table structure for table `reservations`
--

CREATE TABLE `reservations` (
  `id` varchar(20) NOT NULL,
  `account_username` varchar(50) DEFAULT NULL,
  `plate` varchar(20) NOT NULL,
  `vehicle` enum('Automobile','Motorcycle') NOT NULL,
  `driver` varchar(100) NOT NULL,
  `slot` varchar(10) NOT NULL,
  `date` date NOT NULL,
  `time` time NOT NULL,
  `hours` int(11) NOT NULL DEFAULT 2,
  `status` enum('pending','approved','cancelled','expired') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reservations`
--

INSERT INTO `reservations` (`id`, `account_username`, `plate`, `vehicle`, `driver`, `slot`, `date`, `time`, `hours`, `status`, `created_at`) VALUES
('RSV-005', 'vintoy', 'GAB 1234', 'Automobile', 'Vintoy', 'A-03', '2026-11-21', '23:00:00', 3, 'approved', '2026-11-21 13:36:34'),
('RSV-006', 'vintoy', 'BAL 2322', 'Automobile', 'Vintoy', 'A-01', '2026-11-21', '22:03:00', 3, 'approved', '2026-11-21 14:01:50'),
('RSV-007', 'vintoy', '233 ASDD', 'Automobile', 'Vintoy', 'D-04', '2026-11-21', '23:10:00', 4, 'pending', '2026-11-21 15:03:19'),
('RSV-008', 'vintoy', 'DDD 1233', 'Automobile', 'Vintoy', 'A-05', '2026-11-21', '23:07:00', 2, 'pending', '2026-11-21 15:07:50');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(20) NOT NULL,
  `account_username` varchar(50) DEFAULT NULL,
  `plate` varchar(20) NOT NULL,
  `vehicle` enum('Automobile','Motorcycle') NOT NULL,
  `driver` varchar(100) NOT NULL DEFAULT 'Walk-in',
  `slot` varchar(10) NOT NULL,
  `entry` bigint(20) NOT NULL,
  `duration` int(11) DEFAULT NULL,
  `reservation_id` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `account_username`, `plate`, `vehicle`, `driver`, `slot`, `entry`, `duration`, `reservation_id`) VALUES
('TCK-20511', 'vintoy', 'GAB 1234', 'Automobile', 'Vintoy', 'A-03', 1795268259087, 4, 'RSV-005'),
('TCK-20513', 'vintoy', 'BAL 2322', 'Automobile', 'Vintoy', 'A-01', 1795269741048, 3, 'RSV-006');

-- --------------------------------------------------------

--
-- Table structure for table `slots`
--

CREATE TABLE `slots` (
  `id` varchar(10) NOT NULL,
  `facility_id` varchar(50) NOT NULL,
  `zone` varchar(5) NOT NULL,
  `vehicle_type` enum('Automobile','Motorcycle') NOT NULL,
  `is_pwd` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('available','occupied','reserved','out_of_service') NOT NULL DEFAULT 'available',
  `plate` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `slots`
--

INSERT INTO `slots` (`id`, `facility_id`, `zone`, `vehicle_type`, `is_pwd`, `status`, `plate`) VALUES
('A-01', 'fac-sanciangko', 'A', 'Automobile', 0, 'occupied', 'BAL 2322'),
('A-02', 'fac-sanciangko', 'A', 'Automobile', 0, 'available', NULL),
('A-03', 'fac-sanciangko', 'A', 'Automobile', 0, 'occupied', 'GAB 1234'),
('A-04', 'fac-sanciangko', 'A', 'Automobile', 0, 'available', NULL),
('A-05', 'fac-sanciangko', 'A', 'Automobile', 0, 'reserved', 'DDD 1233'),
('A-06', 'fac-sanciangko', 'A', 'Automobile', 0, 'available', NULL),
('A-07', 'fac-sanciangko', 'A', 'Automobile', 0, 'available', NULL),
('A-08', 'fac-sanciangko', 'A', 'Automobile', 0, 'available', NULL),
('A-09', 'fac-sanciangko', 'A', 'Automobile', 0, 'available', NULL),
('A-10', 'fac-sanciangko', 'A', 'Automobile', 1, 'available', NULL),
('B-01', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-02', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-03', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-04', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-05', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-06', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-07', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-08', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-09', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('B-10', 'fac-sanciangko', 'B', 'Automobile', 0, 'available', NULL),
('C-01', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-02', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-03', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-04', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-05', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-06', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-07', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-08', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-09', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('C-10', 'fac-sanciangko', 'C', 'Motorcycle', 0, 'available', NULL),
('D-01', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-02', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-03', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-04', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'reserved', '233 ASDD'),
('D-05', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-06', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-07', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-08', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-09', 'fac-plaza-independencia', 'D', 'Automobile', 0, 'available', NULL),
('D-10', 'fac-plaza-independencia', 'D', 'Automobile', 1, 'available', NULL),
('D-11', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-12', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-13', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-14', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-15', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-16', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-17', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-18', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-19', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('D-20', 'fac-sanciangko', 'D', 'Motorcycle', 0, 'available', NULL),
('E-01', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-02', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-03', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-04', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-05', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-06', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-07', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-08', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-09', 'fac-plaza-independencia', 'E', 'Automobile', 0, 'available', NULL),
('E-10', 'fac-plaza-independencia', 'E', 'Automobile', 1, 'available', NULL),
('F-01', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-02', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-03', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-04', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-05', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-06', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-07', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-08', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-09', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('F-10', 'fac-plaza-independencia', 'F', 'Motorcycle', 0, 'available', NULL),
('G-01', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-02', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-03', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-04', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-05', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-06', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-07', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-08', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-09', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL),
('G-10', 'fac-plaza-independencia', 'G', 'Motorcycle', 0, 'available', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`username`),
  ADD UNIQUE KEY `uq_accounts_email` (`email`),
  ADD KEY `fk_accounts_facility` (`facility_id`);

--
-- Indexes for table `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_damage_slot` (`slot_id`);

--
-- Indexes for table `facilities`
--
ALTER TABLE `facilities`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `fired_alerts`
--
ALTER TABLE `fired_alerts`
  ADD PRIMARY KEY (`username`,`alert_key`,`flag`);

--
-- Indexes for table `history`
--
ALTER TABLE `history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_history_account` (`account_username`),
  ADD KEY `idx_history_exit` (`exit`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_user` (`username`);

--
-- Indexes for table `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_res_account` (`account_username`),
  ADD KEY `fk_res_slot` (`slot`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sessions_account` (`account_username`),
  ADD KEY `fk_sessions_slot` (`slot`);

--
-- Indexes for table `slots`
--
ALTER TABLE `slots`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_slots_facility` (`facility_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `accounts`
--
ALTER TABLE `accounts`
  ADD CONSTRAINT `fk_accounts_facility` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD CONSTRAINT `fk_damage_slot` FOREIGN KEY (`slot_id`) REFERENCES `slots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `fired_alerts`
--
ALTER TABLE `fired_alerts`
  ADD CONSTRAINT `fk_alerts_account` FOREIGN KEY (`username`) REFERENCES `accounts` (`username`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `history`
--
ALTER TABLE `history`
  ADD CONSTRAINT `fk_history_account` FOREIGN KEY (`account_username`) REFERENCES `accounts` (`username`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_account` FOREIGN KEY (`username`) REFERENCES `accounts` (`username`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `fk_res_account` FOREIGN KEY (`account_username`) REFERENCES `accounts` (`username`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_res_slot` FOREIGN KEY (`slot`) REFERENCES `slots` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `fk_sessions_account` FOREIGN KEY (`account_username`) REFERENCES `accounts` (`username`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sessions_slot` FOREIGN KEY (`slot`) REFERENCES `slots` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `slots`
--
ALTER TABLE `slots`
  ADD CONSTRAINT `fk_slots_facility` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
