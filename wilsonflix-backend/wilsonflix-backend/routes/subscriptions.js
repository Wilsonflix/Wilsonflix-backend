// routes/subscriptions.js
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const PLANS = {
  premium: { price: 19.90, duration_days: 30, label: 'Premium' },
  ultra:   { price: 34.90, duration_days: 30, label: 'Ultra' },
};

// Planos disponíveis
router.get('/plans', (req, res) => res.json({
  free:    { price: 0,     features: ['Animes com anúncios','SD 480p','1 dispositivo'] },
  premium: { price: 19.90, features: ['Sem anúncios','HD 1080p','2 dispositivos','Acesso antecipado'] },
  ultra:   { price: 34.90, features: ['Sem anúncios','4K Ultra HD','4 dispositivos','Downloads offline','Acesso antecipado'] },
}));

// Minha subscrição
router.get('/my', requireAuth, (req, res) => {
  const sub = db.prepare(`
    SELECT * FROM subscriptions WHERE user_id=? AND status='active' ORDER BY created_at DESC LIMIT 1
  `).get(req.user.id);
  const user = db.prepare('SELECT plan, plan_expires_at FROM users WHERE id=?').get(req.user.id);
  res.json({ plan: user.plan, expires_at: user.plan_expires_at, subscription: sub || null });
});

// Ativar subscrição (simulado — integrar com gateway de pagamento)
router.post('/activate', requireAuth, (req, res) => {
  const { plan, payment_ref } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Plano inválido.' });

  const planInfo = PLANS[plan];
  const expires = new Date();
  expires.setDate(expires.getDate() + planInfo.duration_days);
  const expiresISO = expires.toISOString();

  const id = uuid();
  db.prepare(`
    INSERT INTO subscriptions (id,user_id,plan,price,expires_at,payment_ref)
    VALUES (?,?,?,?,?,?)
  `).run(id, req.user.id, plan, planInfo.price, expiresISO, payment_ref || 'demo');

  db.prepare('UPDATE users SET plan=?, plan_expires_at=? WHERE id=?')
    .run(plan, expiresISO, req.user.id);

  res.json({ message: `Plano ${planInfo.label} ativado até ${expires.toLocaleDateString('pt-BR')}!`, expires: expiresISO });
});

// Cancelar subscrição
router.post('/cancel', requireAuth, (req, res) => {
  db.prepare(`UPDATE subscriptions SET status='cancelled' WHERE user_id=? AND status='active'`).run(req.user.id);
  db.prepare(`UPDATE users SET plan='free', plan_expires_at=NULL WHERE id=?`).run(req.user.id);
  res.json({ message: 'Subscrição cancelada. Acesso até ao fim do período.' });
});

module.exports = router;
