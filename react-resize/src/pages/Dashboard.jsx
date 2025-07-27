import LogsTable from '../components/LogsTable'; // ✅ เปลี่ยน path ตามจริง

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <LogsTable />
    </div>
  );
};

export default Dashboard;
