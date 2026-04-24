import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const navItems = [
    { label: "Home", path: "/" },
    { label: "Projects", path: "/project" },
    { label: "Tasks", path: "/tasks" },
  ];

  return (
    <nav className="w-full bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="text-xl font-semibold tracking-wide">
          Orchestration System
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((n) => (
            <Link
              to={n.path}
              className="hover:text-gray-300 transition cursor-pointer p-2"
              key={n.label}
            >
              {n.label}
            </Link>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <Link
            to={"/login"}
            className="px-4 py-1.5 bg-blue-600 rounded-md hover:bg-blue-700 transition text-sm"
          >
            Login
          </Link>
          <Link
            to={"signup"}
            className="px-4 py-1.5 border border-gray-400 rounded-md hover:bg-gray-800 transition text-sm"
          >
            Signup
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
