import { IAssignment, IGeneratedOutput, ISection, IQuestion } from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(a: IAssignment): string {
  return `You are an expert academic question paper generator for Indian schools (CBSE/ICSE).
Generate a complete, high-quality question paper.

Subject: ${a.subject}
Title: ${a.title}
Total Questions: ${a.numberOfQuestions}
Total Marks: ${a.totalMarks}
Question Types: ${a.questionTypes.join(', ')}
Difficulty: ${a.difficulty === 'mixed' ? 'Mix — 30% easy, 50% medium, 20% hard' : a.difficulty}
${a.additionalInstructions ? `Special Instructions: ${a.additionalInstructions}` : ''}
${a.fileContent ? `Reference Content (use this to frame questions):\n${a.fileContent.slice(0, 2000)}` : ''}

RULES:
- Return ONLY a JSON object, no markdown fences, no explanation
- Total marks across ALL sections must equal exactly ${a.totalMarks}
- Total questions across ALL sections must equal exactly ${a.numberOfQuestions}
- Questions must be specific, academically rigorous, and about ${a.subject}
- Each question must have: text, difficulty (easy|medium|hard), marks (number), type (string)
- Group into logical sections: Section A = short/MCQ (1-2 marks), Section B = medium (3-5 marks), Section C = long (5-10 marks)

JSON schema:
{
  "subject": "string",
  "totalMarks": number,
  "duration": "string",
  "grade": "string or empty",
  "sections": [
    {
      "title": "Section A",
      "instruction": "Attempt all questions. Each question carries N marks.",
      "totalMarks": number,
      "questions": [
        { "text": "Full question text here", "difficulty": "easy", "marks": 1, "type": "MCQ" }
      ]
    }
  ]
}`;
}

// ── Provider implementations ────────────────────────────────────────────────

async function tryGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes('your_')) throw new Error('No Gemini key');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 4096 } }) }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json() as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini: empty');
  return text;
}

async function tryOpenRouter(prompt: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key.includes('your_')) throw new Error('No OpenRouter key');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://vedaai.app', 'X-Title': 'VedaAI' },
    body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json() as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter: empty');
  return text;
}

async function tryGroq(prompt: string): Promise<string> {
  const key = process.env.GROK_API_KEY;
  if (!key || key.includes('your_')) throw new Error('No Groq key');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json() as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq: empty');
  return text;
}

async function tryMistral(prompt: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key || key.includes('your_')) throw new Error('No Mistral key');
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const data = await res.json() as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Mistral: empty');
  return text;
}

async function tryCohere(prompt: string): Promise<string> {
  const key = process.env.COHERE_API_KEY;
  if (!key || key.includes('your_')) throw new Error('No Cohere key');
  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'command-r-plus', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`Cohere ${res.status}`);
  const data = await res.json() as any;
  const text = data?.message?.content?.[0]?.text;
  if (!text) throw new Error('Cohere: empty');
  return text;
}

const PROVIDERS = [
  { name: 'Groq',       fn: tryGroq },
  { name: 'Gemini',     fn: tryGemini },
  { name: 'OpenRouter', fn: tryOpenRouter },
  { name: 'Mistral',    fn: tryMistral },
  { name: 'Cohere',     fn: tryCohere },
];

async function callWithFallback(prompt: string): Promise<string | null> {
  for (const p of PROVIDERS) {
    try {
      console.log(`[AI] Trying ${p.name}...`);
      const result = await p.fn(prompt);
      console.log(`[AI] ✅ ${p.name} succeeded`);
      return result;
    } catch (err: any) {
      console.warn(`[AI] ❌ ${p.name}: ${err?.message}`);
    }
  }
  return null; // all failed → use high-quality mock
}

// ── Parse LLM response ──────────────────────────────────────────────────────
function parseResponse(raw: string, a: IAssignment): IGeneratedOutput {
  const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const sections: ISection[] = (parsed.sections || []).map((sec: any) => {
    const questions: IQuestion[] = (sec.questions || []).map((q: any) => ({
      id: uuidv4(), text: q.text || '', difficulty: q.difficulty || 'medium',
      marks: Number(q.marks) || 1, type: q.type || 'short',
    }));
    return { title: sec.title || 'Section', instruction: sec.instruction || 'Attempt all questions.', questions, totalMarks: questions.reduce((s, q) => s + q.marks, 0) };
  });
  return { subject: parsed.subject || a.subject, totalMarks: parsed.totalMarks || a.totalMarks, duration: parsed.duration || '2 hours', grade: parsed.grade || '', sections, generatedAt: new Date() };
}

// ── High-quality subject-aware mock ─────────────────────────────────────────
const QUESTION_BANKS: Record<string, { easy: string[]; medium: string[]; hard: string[] }> = {
  default: {
    easy: [
      'Define the term "{subject}" and explain its basic concept.',
      'What is the SI unit of measurement used in {subject}?',
      'State any two important properties related to {subject}.',
      'Name the scientist who first proposed the fundamental law of {subject}.',
      'Fill in the blank: The basic unit of _______ in {subject} is called ______.',
      'True or False: All reactions in {subject} follow the law of conservation.',
      'What do you mean by the term "equilibrium" in the context of {subject}?',
      'Give one real-life example where concepts of {subject} are applied.',
    ],
    medium: [
      'Explain with a suitable diagram how the process of {subject} works in daily life.',
      'Describe the relationship between cause and effect in {subject} with examples.',
      'Compare and contrast two major theories in {subject}. Give two differences.',
      'A student performs an experiment in {subject}. Explain what observations they would make.',
      'Derive the formula used to calculate the primary quantity in {subject}.',
      'Explain the role of {subject} in modern technology. Give two examples.',
      'What are the limitations of the standard model in {subject}? Explain briefly.',
      'Draw a labelled diagram showing the key components involved in {subject}.',
    ],
    hard: [
      'Critically evaluate the impact of recent developments in {subject} on society. Support with evidence.',
      'A complex scenario involves multiple {subject} principles. Identify, analyze, and propose a solution with calculations.',
      'Discuss the historical evolution of {subject} and how modern understanding has changed traditional views.',
      'Design an experiment to verify a fundamental law in {subject}. Include hypothesis, procedure, and expected results.',
      'Derive and explain the significance of the governing equation in {subject} from first principles.',
      'How does {subject} interact with adjacent fields of study? Discuss with two cross-disciplinary examples.',
    ],
  },
  physics: {
    easy: [
      'Define velocity and distinguish it from speed.',
      'State Newton\'s First Law of Motion.',
      'What is the SI unit of force?',
      'Define electric current. What instrument measures it?',
      'State Ohm\'s Law.',
      'What is the law of reflection of light?',
      'Define potential energy.',
      'What is the difference between a scalar and a vector quantity?',
    ],
    medium: [
      'A car accelerates from rest at 4 m/s². Calculate the distance covered in 5 seconds.',
      'State and derive the equation for kinetic energy from first principles.',
      'Explain how a transformer works and derive the turns ratio formula.',
      'Draw a ray diagram showing image formation by a concave mirror for an object placed beyond the centre of curvature.',
      'Explain the working principle of an electric motor with a labelled diagram.',
      'A resistor of 10Ω is connected across a 5V battery. Calculate the current and power dissipated.',
      'Explain the concept of total internal reflection and state its two conditions.',
      'Derive the expression for gravitational potential energy.',
    ],
    hard: [
      'Derive Snell\'s Law from Huygens\' wave theory. Explain the significance of the refractive index.',
      'A circuit has three resistors (6Ω, 4Ω, 12Ω) — first in series, then in parallel across 24V. Find the total current in both cases and compare power dissipated.',
      'Explain the photoelectric effect. How did Einstein\'s interpretation conflict with classical wave theory? Derive the photoelectric equation.',
      'A projectile is launched at 45° with initial speed 20 m/s. Find maximum height, range, and time of flight. Show all working.',
      'Derive Kepler\'s Third Law of planetary motion from Newton\'s law of gravitation.',
    ],
  },
  mathematics: {
    easy: [
      'Find the HCF of 48 and 18 using the Euclidean algorithm.',
      'Factorize: x² + 5x + 6.',
      'If the radius of a circle is 7 cm, find its area.',
      'Solve: 3x + 7 = 22.',
      'Find the slope of the line passing through (2, 3) and (5, 9).',
      'What is the sum of interior angles of a hexagon?',
      'Evaluate: sin²30° + cos²30°.',
      'Find the mean of: 4, 7, 13, 16, 21, 2, 3.',
    ],
    medium: [
      'Prove that √2 is irrational.',
      'Find all zeroes of the polynomial p(x) = x³ − 4x² + x + 6 given that x=2 is a zero.',
      'A ladder 13 m long leans against a wall. Its foot is 5 m from the base. Find the height reached on the wall.',
      'Prove that the tangent at any point on a circle is perpendicular to the radius at that point.',
      'Solve the quadratic equation 2x² − 7x + 3 = 0 using the quadratic formula.',
      'The sum of digits of a two-digit number is 9. If 27 is subtracted, the digits reverse. Find the number.',
      'Find the area of a triangle with vertices A(1,2), B(4,6), C(3,1) using the coordinate formula.',
      'If tan θ = 7/24, find sin θ and cos θ without using a calculator.',
    ],
    hard: [
      'Using the concept of similar triangles, prove the Basic Proportionality Theorem (Thales\' Theorem).',
      'A sphere, a cylinder, and a cone have the same radius and height. Prove that their volumes are in ratio 2:3:1.',
      'Evaluate: ∫(x² + 3x − 2)dx from 0 to 2. Verify by checking with the area under the curve.',
      'Solve the system: 3x + 4y + 5z = 18; 2x − y + 3z = 5; x + 2y − z = 2.',
      'Prove using mathematical induction that n³ + 2n is divisible by 3 for all positive integers n.',
    ],
  },
  chemistry: {
    easy: [
      'Define an atom and an element.',
      'What is the atomic number of carbon?',
      'State the law of conservation of mass.',
      'Name two physical properties that distinguish metals from non-metals.',
      'What is pH? Is pure water acidic, basic, or neutral?',
      'Define valency with an example.',
      'What is the chemical formula of glucose?',
      'Name the gas produced when zinc reacts with dilute HCl.',
    ],
    medium: [
      'Balance the equation: Fe + O₂ → Fe₂O₃. What type of reaction is this?',
      'Explain the electron configuration of sodium (Na) and why it readily forms Na⁺.',
      'Describe the preparation and properties of hydrogen gas in the lab.',
      'What happens when soap is added to hard water? Explain the chemistry involved.',
      'Draw the Lewis dot structure for H₂O and CO₂. Compare their molecular geometries.',
      'Explain the process of electrolysis of brine. Write the half-equations at each electrode.',
      'What is the difference between exothermic and endothermic reactions? Give one example of each.',
      'Explain how rusting of iron occurs. Write the overall chemical equation.',
    ],
    hard: [
      'How is sodium hydroxide manufactured industrially using the chlor-alkali process? Write all electrode reactions.',
      'Explain the periodic trends in atomic radius, ionization energy, and electronegativity across Period 3.',
      'A 2.5g sample of an oxide of copper contains 2g of copper. Determine the empirical formula. (Cu=64, O=16)',
      'Explain Le Chatelier\'s principle. How does changing temperature, pressure, and concentration affect the Haber process equilibrium?',
      'Design an experiment to verify that photosynthesis requires light and CO₂. Include controls and expected results.',
    ],
  },
  history: {
    easy: [
      'When did the First World War begin?',
      'Name the leader of the Indian independence movement.',
      'What was the Dandi March?',
      'In which year did India gain independence?',
      'Who founded the Indian National Congress?',
      'Name the capital of the Mughal Empire.',
      'What is the significance of the year 1857 in Indian history?',
      'Who wrote the Arthashastra?',
    ],
    medium: [
      'Explain the causes of the First World War. Which was the most significant in your view?',
      'Describe the significance of the Jallianwala Bagh massacre (1919) in the Indian independence movement.',
      'Compare the French Revolution and the American Revolution — similarities and key differences.',
      'Explain the impact of the British industrial revolution on Indian cottage industries.',
      'Describe the role of women in the Indian National Movement. Name three prominent leaders.',
      'Explain the partition of Bengal (1905) and its consequences.',
      'How did the Non-Cooperation Movement of 1920-22 impact British rule in India?',
      'Describe the economic policies of the Mughal Empire. How did they affect trade?',
    ],
    hard: [
      'Critically analyze the factors that led to the decline of the Mughal Empire. Which factor was most decisive?',
      'Compare the governance strategies of Akbar and Aurangzeb. How did their approaches affect the stability of the empire?',
      'Evaluate the role of mass media and propaganda in the rise of Nazi Germany.',
      'Discuss the long-term consequences of the Partition of India in 1947 on the subcontinent\'s politics.',
      'To what extent was the Cold War an ideological conflict? Analyze using specific events from 1947-1989.',
    ],
  },
};

function getQBank(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes('physics')) return QUESTION_BANKS.physics;
  if (s.includes('math')) return QUESTION_BANKS.mathematics;
  if (s.includes('chem')) return QUESTION_BANKS.chemistry;
  if (s.includes('hist')) return QUESTION_BANKS.history;
  return QUESTION_BANKS.default;
}

function fillTemplate(q: string, subject: string): string {
  return q.replace(/\{subject\}/g, subject);
}

function buildMockOutput(a: IAssignment): IGeneratedOutput {
  const bank = getQBank(a.subject);
  const easyPool   = [...bank.easy].sort(() => Math.random() - 0.5);
  const mediumPool = [...bank.medium].sort(() => Math.random() - 0.5);
  const hardPool   = [...bank.hard].sort(() => Math.random() - 0.5);

  const totalQ = a.numberOfQuestions;
  const totalM = a.totalMarks;

  let easyCount:  number, medCount: number, hardCount: number;
  if (a.difficulty === 'easy')   { easyCount = totalQ; medCount = 0; hardCount = 0; }
  else if (a.difficulty === 'hard') { easyCount = 0; medCount = 0; hardCount = totalQ; }
  else if (a.difficulty === 'medium') { easyCount = 0; medCount = totalQ; hardCount = 0; }
  else { // mixed
    hardCount = Math.max(1, Math.floor(totalQ * 0.2));
    easyCount = Math.max(1, Math.floor(totalQ * 0.3));
    medCount  = totalQ - easyCount - hardCount;
  }

  // Assign marks proportionally
  const marksPerEasy  = 1;
  const marksPerHard  = Math.floor((totalM * 0.4) / Math.max(hardCount, 1));
  const remainingM    = totalM - easyCount * marksPerEasy - hardCount * marksPerHard;
  const marksPerMed   = medCount > 0 ? Math.floor(remainingM / medCount) : 0;
  const leftover      = totalM - easyCount * marksPerEasy - hardCount * marksPerHard - medCount * marksPerMed;

  const makeQ = (pool: string[], diff: 'easy'|'medium'|'hard', marks: number, idx: number): IQuestion => ({
    id: uuidv4(),
    text: fillTemplate(pool[idx % pool.length], a.subject),
    difficulty: diff, marks, type: diff === 'easy' ? 'Short Answer' : diff === 'hard' ? 'Long Answer' : 'Descriptive',
  });

  const sections: ISection[] = [];

  if (easyCount > 0) {
    const questions = Array.from({ length: easyCount }, (_, i) => makeQ(easyPool, 'easy', marksPerEasy, i));
    sections.push({ title: 'Section A', instruction: `Attempt all questions. Each question carries ${marksPerEasy} mark.`, questions, totalMarks: easyCount * marksPerEasy });
  }

  if (medCount > 0) {
    const questions = Array.from({ length: medCount }, (_, i) => {
      const marks = i === 0 ? marksPerMed + leftover : marksPerMed; // absorb leftover in first question
      return makeQ(mediumPool, 'medium', marks, i);
    });
    sections.push({ title: 'Section B', instruction: `Attempt all questions. Each question carries ${marksPerMed} marks.`, questions, totalMarks: questions.reduce((s, q) => s + q.marks, 0) });
  }

  if (hardCount > 0) {
    const questions = Array.from({ length: hardCount }, (_, i) => makeQ(hardPool, 'hard', marksPerHard, i));
    sections.push({ title: 'Section C', instruction: `Attempt any ${hardCount} question${hardCount > 1 ? 's' : ''}. Each question carries ${marksPerHard} marks.`, questions, totalMarks: hardCount * marksPerHard });
  }

  return { subject: a.subject, totalMarks: a.totalMarks, duration: totalM <= 20 ? '45 minutes' : totalM <= 50 ? '1.5 hours' : '3 hours', grade: '', sections, generatedAt: new Date() };
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function generateQuestionPaper(a: IAssignment): Promise<IGeneratedOutput> {
  const prompt = buildPrompt(a);
  const raw = await callWithFallback(prompt);

  if (raw) {
    try {
      return parseResponse(raw, a);
    } catch (parseErr) {
      console.warn('[AI] Parse failed, using mock:', parseErr);
    }
  }

  console.log('[AI] Using high-quality mock generator');
  return buildMockOutput(a);
}
