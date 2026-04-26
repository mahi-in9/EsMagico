import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/api";

const createProject = createAsyncThunk(
  "project/createProject",
  async (projectData, thunkApi) => {
    try {
      const res = await api.post("/api/project", projectData);
      return res.data.data;
    } catch (error) {
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
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const getProjectById = createAsyncThunk(
  "project/getProjectById",
  async (projectId, thunkApi) => {
    try {
      const res = await api.get(`/api/project/${projectId}`);
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const generateInvite = createAsyncThunk(
  "project/generateInvite",
  async (projectId, thunkApi) => {
    try {
      const res = await api.post(`/api/project/${projectId}/invite`);
      return res.data.data; // { inviteToken }
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const joinProject = createAsyncThunk(
  "project/joinProject",
  async (token, thunkApi) => {
    try {
      const res = await api.post(`/api/project/join/${token}`);
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const projectSlice = createSlice({
  name: "project",
  initialState: {
    projects: [],
    currentProject: null,
    inviteToken: null,
    projectLoading: false,
    projectError: null,
  },
  reducers: {
    clearInviteToken(state) {
      state.inviteToken = null;
    },
    clearCurrentProject(state) {
      state.currentProject = null;
    },
  },
  extraReducers: (builder) => {
    // createProject
    builder
      .addCase(createProject.pending, (state) => {
        state.projectLoading = true;
        state.projectError = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.projectLoading = false;
        state.projects.push(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.projectLoading = false;
        state.projectError = action.payload;
      });

    // getProjects
    builder
      .addCase(getProjects.pending, (state) => {
        state.projectLoading = true;
        state.projectError = null;
      })
      .addCase(getProjects.fulfilled, (state, action) => {
        state.projectLoading = false;
        state.projects = action.payload;
      })
      .addCase(getProjects.rejected, (state, action) => {
        state.projectLoading = false;
        state.projectError = action.payload;
      });

    // getProjectById
    builder
      .addCase(getProjectById.pending, (state) => {
        state.projectLoading = true;
        state.projectError = null;
      })
      .addCase(getProjectById.fulfilled, (state, action) => {
        state.projectLoading = false;
        state.currentProject = action.payload;
      })
      .addCase(getProjectById.rejected, (state, action) => {
        state.projectLoading = false;
        state.projectError = action.payload;
      });

    // generateInvite
    builder
      .addCase(generateInvite.fulfilled, (state, action) => {
        state.inviteToken = action.payload.inviteToken;
      })
      .addCase(generateInvite.rejected, (state, action) => {
        state.projectError = action.payload;
      });

    // joinProject
    builder
      .addCase(joinProject.fulfilled, (state, action) => {
        state.projects.push(action.payload);
      })
      .addCase(joinProject.rejected, (state, action) => {
        state.projectError = action.payload;
      });
  },
});

export const { clearInviteToken, clearCurrentProject } = projectSlice.actions;
export {
  createProject,
  getProjects,
  getProjectById,
  generateInvite,
  joinProject,
};
export default projectSlice.reducer;
