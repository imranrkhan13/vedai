import 'dotenv/config';
(async()=>{
 const specs=[
 ['Groq','https://api.groq.com/openai/v1/models',process.env.GROQ_API_KEY,{Authorization:`Bearer ${process.env.GROQ_API_KEY}`}],
 ['Gemini','https://generativelanguage.googleapis.com/v1beta/models',process.env.GEMINI_API_KEY,{'x-goog-api-key':process.env.GEMINI_API_KEY!}],
 ['Cohere','https://api.cohere.com/v1/models',process.env.COHERE_API_KEY,{Authorization:`Bearer ${process.env.COHERE_API_KEY}`}],
 ['Mistral','https://api.mistral.ai/v1/models',process.env.MISTRAL_API_KEY,{Authorization:`Bearer ${process.env.MISTRAL_API_KEY}`}],
 ['OpenRouter','https://openrouter.ai/api/v1/models',process.env.OPENROUTER_API_KEY,{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`}],
 ['Jev','https://api.typesafe.ai/v1/models',process.env.TYPESAFE_API_KEY,{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`}]
 ] as const;
 for(const [name,url,key,headers] of specs){if(!key)continue;try {const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});const d:any=await r.json();const models=d.data||d.models||[];console.log(name, r.status, models.filter((m:any)=>/flash|llama|command|jev|:free/.test(m.id||m.name||'')).slice(0,18).map((m:any)=>m.id||m.name));}catch(e){console.log(name,'request failed');}}
})();
