import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import api from "../../api/api";

const createProject = createAsyncThunk(
  "project/createProject",
  async (projectData, thunkApi) => {
    try {
      console.log(projectData);
      const res = await api.post("/api/project", projectData);
      console.log(res);
      return res.data.data;
    } catch (error) {
      console.log(error);
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const getProjects = createAsyncThunk(
  "project/getProjects",
  async (_, thunkApi) => {
    try {
      const res = await api.get("/api/project");
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response.data);
    }
  },
);

const projectSlice = createSlice({
  name: "project",
  initialState: {
    projects: [],
    projectLoading: false,
    projectError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createProject.pending, (state) => {
        state.projectLoading = true;
        state.projectError = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.projectLoading = false;
        state.projects.push(action.payload);
        state.projectError = null;
      })
      .addCase(createProject.rejected, (state, action) => {
        state.projectLoading = false;
        state.projectError = action.payload;
      })
      .addCase(getProjects.pending, (state) => {
        state.projectLoading = true;
        state.projectError = null;
      })
      .addCase(getProjects.fulfilled, (state, action) => {
        state.projectLoading = false;
        state.projects = action.payload;
        state.projectError = null;
      })
      .addCase(getProjects.rejected, (state, action) => {
        state.projectLoading = false;
        state.projectError = action.payload;
      });
  },
});

export { createProject, getProjects };
export default projectSlice.reducer;
