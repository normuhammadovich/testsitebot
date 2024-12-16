const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// main.zip va PDF lar bir joyda bo'lsa, pdfni to'g'ridan-to'g'ri express.static bilan xizmat qilish mumkin.
app.use(express.static(path.join(__dirname)));

app.get('/document', (req, res) => {
    res.sendFile(path.join(__dirname, 'document.pdf'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
