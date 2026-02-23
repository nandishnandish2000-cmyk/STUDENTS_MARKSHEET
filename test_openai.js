require('dotenv').config();
const OpenAI = require('openai');

async function testKey() {
    console.log('Key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    if (!process.env.OPENAI_API_KEY) return;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 5
        });
        console.log('API Test Success:', response.choices[0].message.content);
    } catch (err) {
        console.error('API Test Failed:', err.message);
    }
}

testKey();
