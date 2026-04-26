import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../app/slice/authSlice";

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <nav className="w-full bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-wide text-blue-400">
          ⚙ EsMagico
        </Link>

        {user && (
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="hover:text-gray-300 transition">
              Dashboard
            </Link>
            <Link to="/project" className="hover:text-gray-300 transition">
              Projects
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-gray-400 hidden sm:block">
                👤 {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-1.5 bg-red-600 rounded-md hover:bg-red-700 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-1.5 bg-blue-600 rounded-md hover:bg-blue-700 transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 border border-gray-400 rounded-md hover:bg-gray-800 transition"
              >
                Signup
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
