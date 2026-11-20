import LoginForm from './LoginForm.jsx';

export default function StaffLogin() {
  return (
    <LoginForm
      title="Masuk ke dashboard restoran"
      subtitle="Hak akses mengikuti peran: Owner, Kasir, Dapur, atau Waiter. Satu pegawai boleh punya beberapa peran. Buka beberapa tab untuk mencoba peran berbeda sekaligus."
      expect="staff"
      redirect="/dashboard"
      demoAccounts={[
        { name: 'Ratna Sari', email: 'owner@kedairasa.test', role: 'owner', label: 'Owner · Kasir · Dapur · Waiter' },
        { name: 'Dimas Pratama', email: 'cashier@kedairasa.test', role: 'cashier', label: 'Kasir · Waiter' },
        { name: 'Joko Susilo', email: 'kitchen@kedairasa.test', role: 'kitchen', label: 'Dapur' },
        { name: 'Sari Lestari', email: 'waiter@kedairasa.test', role: 'waiter', label: 'Waiter' },
      ]}
    />
  );
}
