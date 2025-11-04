import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Trash2,
  LogOut,
  Users,
  Shield,
  AlertCircle,
} from "lucide-react";

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
  });

  const navigate = useNavigate();
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const token = currentUser?.token;

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (!token || !currentUser?.role) {
      navigate("/");
      return;
    }
    if (currentUser.role !== "admin") {
      navigate("/app");
      return;
    }
    fetchUsers();
  }, [navigate]);

  // Helper: Authenticated fetch
  const apiFetch = async (endpoint, method = "GET", body = null) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      navigate("/");
      throw new Error("Session expired. Please log in again.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "API request failed");
    return data;
  };

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/users");
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add new user
  const handleAddUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Enforce tristone-partners.com domain for email
    const email = String(newUser.email || '').trim().toLowerCase();
    if (!email.endsWith('@tristone-partners.com')) {
      setError('Email must be a tristone-partners.com address');
      return;
    }

    try {
      await apiFetch("/api/users", "POST", { ...newUser, email });
      setSuccess("User created successfully!");
      setNewUser({ username: "", email: "", password: "", role: "user" });
      setShowAddForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete user
  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiFetch(`/api/users/${id}`, "DELETE");
      setSuccess("User deleted successfully!");
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background:
          "linear-gradient(to bottom right, rgba(87, 194, 147, 0.1), rgba(87, 194, 147, 0.15))",
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Shield size={32} style={{ color: "rgb(87, 194, 147)" }} />
                Admin Dashboard
              </h1>
              <p className="text-gray-600 mt-1">User Management</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Logged in as:{" "}
                <span className="font-medium">{currentUser.email}</span>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-green-600 flex-shrink-0" size={20} />
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Add User Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Users</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition"
              style={{ backgroundColor: "rgb(87, 194, 147)" }}
              onMouseEnter={(e) =>
                (e.target.style.backgroundColor = "rgb(69, 155, 118)")
              }
              onMouseLeave={(e) =>
                (e.target.style.backgroundColor = "rgb(87, 194, 147)")
              }
            >
              <UserPlus size={18} />
              {showAddForm ? "Cancel" : "Add New User"}
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={handleAddUser}
              className="bg-gray-50 rounded-lg p-4 mb-4 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["username", "email", "password"].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <input
                      type={field === "password" ? "password" : "text"}
                      value={newUser[field]}
                      onChange={(e) =>
                        setNewUser({ ...newUser, [field]: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                      placeholder={`Enter ${field}`}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                Create User
              </button>
            </form>
          )}

          {/* Users Table */}
          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Username
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">{u.id}</td>
                      <td className="px-4 py-3">{u.username}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:text-red-800 transition"
                          disabled={u.id === currentUser.id}
                          title={
                            u.id === currentUser.id
                              ? "Cannot delete yourself"
                              : "Delete user"
                          }
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <Users
                    size={48}
                    className="mx-auto mb-2 text-gray-400"
                  />
                  <p>No users found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
