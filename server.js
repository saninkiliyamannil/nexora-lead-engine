const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Nexora Lead Engine running on port ${PORT}`);
});
