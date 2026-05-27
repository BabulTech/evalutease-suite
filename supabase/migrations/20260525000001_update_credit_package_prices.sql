-- Update credit package prices to match live admin panel
-- Starter: 50c → PKR 199 | Value: 100c → PKR 399 | Power: 150c → PKR 499

UPDATE public.credit_packages SET credits = 50,  price_pkr = 199 WHERE name = 'Starter Pack';
UPDATE public.credit_packages SET credits = 100, price_pkr = 399 WHERE name = 'Value Pack';
UPDATE public.credit_packages SET credits = 150, price_pkr = 499 WHERE name = 'Power Pack';
