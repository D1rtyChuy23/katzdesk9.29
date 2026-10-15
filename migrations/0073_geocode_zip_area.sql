-- ZIP-area (approximate) pins saved by the Locations import before it knew about them were stored as 'close', which
-- the map treats as drivable. They are recognisable by the geocoder address the import stores with them
-- ("Irving, TX, 75039 (ZIP area)"). Mark them 'approx' so directions never use the middle of a ZIP code.
update directory_customers
   set geocode_match = 'approx', updated_at = now()
 where geocode_match = 'close'
   and geocode_address ilike '%(zip area)%';
