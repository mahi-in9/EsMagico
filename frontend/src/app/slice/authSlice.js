import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/api";

export const registerUser = createAsyncThunk(
  "auth/register",
  async (data, thunkApi) => {
    try {
      const res = await api.post("/api/auth/register", data);
      localStorage.setItem("token", res.data.token);
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (data, thunkApi) => {
    try {
      const res = await api.post("/api/auth/login", data);
      localStorage.setItem("token", res.data.token);
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

export const fetchUser = createAsyncThunk(
  "auth/fetchUser",
  async (_, thunkApi) => {
    try {
      const res = await api.get("/api/auth/me");
      return res.data.user;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    loading: false,
    user: null,
    error: null,
    isAuthChecked: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      localStorage.removeItem("token");
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const handle = (thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false;
          state.user = action.payload?.user || action.payload;
          if (thunk === fetchUser) state.isAuthChecked = true;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
          if (thunk === fetchUser) state.isAuthChecked = true;
        });
    };
    handle(registerUser);
    handle(loginUser);
    handle(fetchUser);
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
