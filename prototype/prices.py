"""A replaceable price-source adapter; no scraping or retailer API access."""
from datetime import datetime,timezone

class PriceSourceUnavailable(Exception):pass

class DemoPriceProvider:
 def read(self,db):
  return [dict(row) for row in db.execute('SELECT * FROM offers')]
 def refresh(self,db,simulate_failure=False):
  if simulate_failure:raise PriceSourceUnavailable('Учебный сценарий: источник цен недоступен. Предыдущие цены сохранены с их датой.')
  db.execute('UPDATE offers SET updated_at=?',(datetime.now(timezone.utc).isoformat(),))
