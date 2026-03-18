import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChannelGrid from "./components/ChannelGrid";
import Splash from "./components/Splash";
import { loadChannels } from "./services/iptv";
import { useStore } from "./store/useStore";

export default function App() {
  const { setChannels } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannels().then((c) => {
      setChannels(c);
      setTimeout(() => setLoading(false), 1200);
    });
  }, []);

  if (loading) return <Splash />;

  return (
    <div style={{ display: "flex", background: "#141414", color: "white" }}>
      <Sidebar />
      <ChannelGrid />
    </div>
  );
}
