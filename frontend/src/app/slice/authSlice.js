import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/api";

export const registerUser = createAsyncThunk(
  "user/registerUser",
  async (userData, thunkApi) => {
    try {
      const res = await api.post(`/api/auth/register`, userData);
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response.data);
    }
  },
);

export const loginUser = createAsyncThunk(
  "user/login",
  async (userData, thunkApi) => {
    try {
      const res = await api.post(`/api/auth/login`, userData);
      localStorage.setItem("token", res.data.token);
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error.response.data);
    }
  },
);

export const fetchUser = createAsyncThunk(
  "user/fetchUser",
  async (_, thunkApi) => {
    try {
      const res = await api.get(`/api/auth/me`);
      return res.data.user;
    } catch (error) {
      return thunkApi.rejectWithValue(error.response.data);
    }
  },
);

const initialState = {
  loading: false,
  user: null,
  error: null,
  isAuthChecked: false,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = null;
        state.isAuthChecked = true;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthChecked = true;
      });
  },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;
