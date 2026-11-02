import AdminGate from './AdminGate';

export default function AdminLogin() {
  return (
    <AdminGate loginOnly>
      <div />
    </AdminGate>
  );
}
