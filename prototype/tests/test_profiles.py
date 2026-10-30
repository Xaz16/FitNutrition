import sys,unittest
from datetime import date
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from profiles import age_on,validate_profile

class BirthDateTests(unittest.TestCase):
 def test_birthday_boundary_and_leap_day(self):
  self.assertEqual(age_on('2000-10-30',date(2026,10,29)),25)
  self.assertEqual(age_on('2000-10-30',date(2026,10,30)),26)
  self.assertEqual(age_on('2000-02-29',date(2025,2,28)),24)
  self.assertEqual(age_on('2000-02-29',date(2025,3,1)),25)
 def test_invalid_dates(self):
  for value in ['2026-02-30','2999-01-01','2000-2-1',None]:
   with self.assertRaises((ValueError,TypeError)):age_on(value,date(2026,10,30))
 def test_date_overrides_untrusted_age(self):
  profile=validate_profile({'name':'Тест','birth_date':'1996-05-12','age':90,'sex':'male','height':180,'weight':80,'activity':1.2,'goal':'lose'})
  self.assertEqual(profile['age'],age_on('1996-05-12'))
