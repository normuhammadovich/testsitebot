const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Bu bir xil papkada joylashgan fayllarga to'g'ridan-to'g'ri xizmat qiladi
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
