import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; // Import fileURLToPath from 'url'

const PORT = process.env.PORT || 3000;

// Serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, '../client')));


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
