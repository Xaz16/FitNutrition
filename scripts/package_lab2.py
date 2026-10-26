"""Package only the lab deliverables, never the local database or user accounts."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from pypdf import PdfReader,PdfWriter
import shutil,json,xml.etree.ElementTree as ET,argparse

root=Path(__file__).resolve().parents[1];out=root/'output/lab2'
parser=argparse.ArgumentParser();parser.add_argument('--report-pdf',type=Path);args=parser.parse_args()
if args.report_pdf:shutil.copy2(args.report_pdf,out/'Fit_Nutrition_Supply_LR2.pdf')
writer=PdfWriter();original=root/'sources/submitted-lab1/Fit_Nutrition_Supply_ЛР1_отчёт.pdf';writer.append(original);writer.append(out/'Fit_Nutrition_Supply_LR1_Corrections.pdf')
writer.add_outline_item('Дополнение по замечаниям преподавателя',len(PdfReader(original).pages))
with (out/'Fit_Nutrition_Supply_LR1_With_Corrections.pdf').open('wb') as f:writer.write(f)
for file in (root/'docs/lab2/diagrams').glob('*.drawio'):ET.parse(file)
required=['Статус','Контекст','Рассмотренные альтернативы','Принятое решение','Последствия','Роль агента']
for file in (root/'docs/lab2/adr').glob('*.md'):
 text=file.read_text(encoding='utf-8');assert all('## '+s in text for s in required),file
paths=[]
for folder in ['prototype','docs/lab2','output/lab2','tools']:
 paths.extend(p for p in (root/folder).rglob('*') if p.is_file() and not set(p.parts)&{'data','.venv','__pycache__','node_modules'} and p.suffix!='.zip')
paths += [root/p for p in ['README.md','docs/lab1_revision.md','scripts/build_lab_reports.py','scripts/build_lab2_diagrams.cjs','scripts/build_lab2_wireframes.py','scripts/build_entry_diagrams.py','scripts/package_lab2.py','sources/lab2-assignment.txt']]
paths += [p for p in (root/'sources/submitted-lab1').glob('*') if p.is_file()]
archive=out/'Fit_Nutrition_Supply_LR2_Complete.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
 for file in sorted(set(paths)):z.write(file,file.relative_to(root))
with ZipFile(archive) as z:assert z.testzip() is None
print(json.dumps({'files':len(set(paths)),'zip_bytes':archive.stat().st_size,'lab2_pages':len(PdfReader(out/'Fit_Nutrition_Supply_LR2.pdf').pages),'lab1_combined_pages':len(PdfReader(out/'Fit_Nutrition_Supply_LR1_With_Corrections.pdf').pages)}))
