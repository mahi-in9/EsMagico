import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { registerUser, clearAuthError } from "../app/slice/authSlice";
import { useNavigate, Link } from "react-router-dom";

const Signup = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, user } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [fe, setFe] = useState({});

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);
  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Valid email required";
    if (form.password.length < 6) e.password = "Min 6 characters";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    setFe(errs);
    if (!Object.keys(errs).length) dispatch(registerUser(form));
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "radial-gradient(ellipse at center,#1a1d2e 0%,#0f1117 70%)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
            E
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-gray-400 text-sm mt-1">
            Start orchestrating your workflows
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              ["name", "text", "Full name", "Your name"],
              ["email", "email", "Email", "you@example.com"],
              ["password", "password", "Password", "Min 6 characters"],
            ].map(([k, t, label, ph]) => (
              <div key={k}>
                <label className="text-xs text-gray-400 uppercase tracking-wide">
                  {label}
                </label>
                <input
                  type={t}
                  value={form[k]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [k]: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder-gray-600"
                  placeholder={ph}
                />
                {fe[k] && <p className="text-red-400 text-xs mt-1">{fe[k]}</p>}
              </div>
            ))}
            {error && (
              <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2">
                {error?.message || "Registration failed"}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition mt-2"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          Have an account?{" "}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
