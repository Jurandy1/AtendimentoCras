(() => {
  const { createElement: h } = React;
  const Icon = ({ children, className }) => h('span', { className }, children);
  if (!window.Icons) {
    const Home = (p) => h(Icon, { className: p.className }, '🏠');
    const Tv = (p) => h(Icon, { className: p.className }, '📺');
    const Users = (p) => h(Icon, { className: p.className }, '👥');
    const LayoutDashboard = (p) => h(Icon, { className: p.className }, '📊');
    const FileText = (p) => h(Icon, { className: p.className }, '🧾');
    const Settings = (p) => h(Icon, { className: p.className }, '⚙️');
    const LogOut = (p) => h(Icon, { className: p.className }, '↩️');
    const Menu = (p) => h(Icon, { className: p.className }, '☰');
    const X = (p) => h(Icon, { className: p.className }, '✖️');
    const Printer = (p) => h(Icon, { className: p.className }, '🖨️');
    const Plus = (p) => h(Icon, { className: p.className }, '＋');
    const Edit = (p) => h(Icon, { className: p.className }, '✏️');
    const Trash2 = (p) => h(Icon, { className: p.className }, '🗑️');
    const ChevronRight = (p) => h(Icon, { className: p.className }, '›');
    const Clock = (p) => h(Icon, { className: p.className }, '⏰');
    const CheckCircle = (p) => h(Icon, { className: p.className }, '✅');
    const Loader = ({ className, style }) => h('div', { className: `animate-spin ${className || ''}`, style }, '⏳');
    const AlertCircle = (p) => h(Icon, { className: p.className }, '⚠️');
    const UserPlus = (p) => h(Icon, { className: p.className }, '➕👤');
    const Building = (p) => h(Icon, { className: p.className }, '🏢');
    const UserCog = (p) => h(Icon, { className: p.className }, '🧑‍💼');
    const Palette = (p) => h(Icon, { className: p.className }, '🎨');
    const Copy = (p) => h(Icon, { className: p.className }, '📋');
    const ExternalLink = (p) => h(Icon, { className: p.className }, '🔗');
    const Eye = (p) => h(Icon, { className: p.className }, '👁️');
    const EyeOff = (p) => h(Icon, { className: p.className }, '🙈');
    const Download = (p) => h(Icon, { className: p.className }, '⬇️');
    const Calendar = (p) => h(Icon, { className: p.className }, '📅');
    const Filter = (p) => h(Icon, { className: p.className }, '🔍');
    const PieChart = (p) => h(Icon, { className: p.className }, '🥧');
    const BarChart2 = (p) => h(Icon, { className: p.className }, '📉');
    window.Icons = { Home, Tv, Users, LayoutDashboard, FileText, Settings, LogOut, Menu, X, Printer, Plus, Edit, Trash2, ChevronRight, Clock, CheckCircle, Loader, AlertCircle, UserPlus, Building, UserCog, Palette, Copy, ExternalLink, Eye, EyeOff, Download, Calendar, Filter, PieChart, BarChart2 };
  }
})();
