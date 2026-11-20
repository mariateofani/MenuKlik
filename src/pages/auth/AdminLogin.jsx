import LoginForm from './LoginForm.jsx';

export default function AdminLogin() {
  return (
    <LoginForm
      title="Masuk sebagai Super Admin"
      subtitle="Khusus tim pengelola platform MenuKlik."
      expect="admin"
      redirect="/admin"
      demoAccounts={[{ name: 'Tim MenuKlik', email: 'admin@menuklik.test', role: 'admin', label: 'Super Admin' }]}
    />
  );
}
