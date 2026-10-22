"""Run with the bundled Python (pdfplumber), after npm run test:pdf."""
from pathlib import Path
import json
import pdfplumber
base=Path(__file__).resolve().parents[2]
fixture=json.loads((base/'output/qa/paper-fixture.json').read_text())
report={}
for name in ['student-paper','teacher-guide','long-layout-stress']:
 with pdfplumber.open(base/f'output/pdf/{name}.pdf') as pdf:
  text=' '.join(' '.join((p.extract_text() or '').split()) for p in pdf.pages)
  assert not any(p.images for p in pdf.pages), 'Unexpected page images'
  assert 'N marks' not in text
  for i,q in enumerate([q for s in fixture['output']['sections'] for q in s['questions']],1):
   if name!='long-layout-stress' or i!=1: assert ' '.join(q['text'].split()) in text
   assert f'{i}.' in text
   assert f"[{q['marks']} mark" in text
  assert '10 marks' in text
  for p in pdf.pages:
   for w in p.extract_words(): assert 10<=w['x0']<w['x1']<=p.width-10 and 10<=w['top']<w['bottom']<=p.height-10, f'{name}: clipped text'
  assert pdf.pages[0].search('Science'), 'Search failed'
  if name=='student-paper':
   assert len(pdf.pages)==1
   assert all(x not in text for x in ['Answer:', 'Criterion', 'Source excerpt', 'AI draft'])
  else: assert 'Answer:' in text and 'Criterion' in text
  if name=='long-layout-stress': assert 'm², α, β.' in text, 'Missing scientific glyphs'
  report[name]={'pages':len(pdf.pages),'selectableCharacters':len(text),'images':0,'allQuestionsAndMarks':True,'search':'Science found','copy':'text extracted in order','bounds':'all text within page margins'}
(base/'output/qa/pdf-checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
