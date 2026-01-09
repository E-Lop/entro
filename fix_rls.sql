DROP POLICY "Categories are publicly readable" ON categories;

CREATE POLICY "Categories are publicly readable"
  ON categories
  FOR SELECT
  USING (true);
