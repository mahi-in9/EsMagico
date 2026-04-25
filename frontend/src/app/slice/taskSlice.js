import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/api";

const createTask = createAsyncThunk(
  "task/createTask",
  async (taskData, thunkApi) => {
    try {
      const res = await api.post("/api/task", taskData);
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const getTasks = createAsyncThunk("task/getTasks", async (_, thunkApi) => {
  try {
    const res = await api.get("/api/task");
    return res.data.data;
  } catch (error) {
    return thunkApi.rejectWithValue(error?.response.data);
  }
});

const initialState = {
  tasks: [],
  loading: false,
  error: null,
};

const taskSlice = createSlice({
  name: "task",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks.push(action.payload);
        state.error = null;
      })
      .addCase(createTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload;
        state.error = null;
      })
      .addCase(getTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export { createTask, getTasks };
export default taskSlice.reducer;
