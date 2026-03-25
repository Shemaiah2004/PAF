import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import ApprovalRequests from "./pages/Tables/ApprovalRequests";
import SignedInUsers from "./pages/Tables/SignedInUsers";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import TicketList from "./pages/Tickets/TicketList";
import CreateTicketForm from "./pages/Tickets/CreateTicketForm";
import TicketDetails from "./pages/Tickets/TicketDetails";
import {
  RedirectAuthenticatedUser,
  RequireAuth,
  RequireAdmin,
} from "./components/auth/AuthRouteGuards";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route element={<RequireAuth />}>
            {/* Dashboard Layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />

              {/* Others Page */}
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/blank" element={<Blank />} />
              <Route path="/tickets" element={<TicketList />} />
              <Route path="/tickets/new" element={<CreateTicketForm />} />
              <Route path="/tickets/:ticketId" element={<TicketDetails />} />

              {/* Forms */}
              <Route path="/form-elements" element={<FormElements />} />

              {/* Tables */}
              <Route path="/role-requests" element={<BasicTables />} />
              <Route element={<RequireAdmin />}>
                <Route
                  path="/approval-requests"
                  element={<ApprovalRequests />}
                />
                <Route path="/signed-in-users" element={<SignedInUsers />} />
              </Route>

              {/* Ui Elements */}
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/avatars" element={<Avatars />} />
              <Route path="/badge" element={<Badges />} />
              <Route path="/buttons" element={<Buttons />} />
              <Route path="/images" element={<Images />} />
              <Route path="/videos" element={<Videos />} />

              {/* Charts */}
              <Route path="/line-chart" element={<LineChart />} />
              <Route path="/bar-chart" element={<BarChart />} />
            </Route>
          </Route>

          <Route element={<RedirectAuthenticatedUser />}>
            {/* Auth Layout */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
