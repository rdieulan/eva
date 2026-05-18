-- Create test database for integration tests
-- This script runs automatically when the PostgreSQL container is first created

CREATE DATABASE eva_db_test;
GRANT ALL PRIVILEGES ON DATABASE eva_db_test TO eva_user;
