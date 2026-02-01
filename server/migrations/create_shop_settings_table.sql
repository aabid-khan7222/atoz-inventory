-- Shop/Business details for invoice and letterhead
-- Single row (id = 1). Edit via Settings > Shop details (admin/super admin only).

CREATE TABLE IF NOT EXISTS shop_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  shop_name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  address_line3 VARCHAR(255),
  city VARCHAR(100),
  pincode VARCHAR(10),
  state VARCHAR(100),
  state_code VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(255),
  gstin VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO shop_settings (id, shop_name, address_line1, address_line2, address_line3, city, pincode, state, state_code, phone, email, gstin)
VALUES (
  1,
  'A TO Z BATTERIES & ELECTRICAL PARTS',
  'Near Ajanta Chawfully,',
  'Front of HP Petrol Pump,',
  'Taiba Washing,',
  'Jalgaon',
  '425001',
  'Maharashtra',
  '27',
  '9890412516',
  'atozbatteries7222@gmail.com',
  '27CHVPP1094F1ZT'
)
ON CONFLICT (id) DO NOTHING;
