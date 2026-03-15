import { useEffect } from "react";
import { useLocation } from "wouter";

// Projects were replaced by CRS in v4.0 — redirect to dashboard
export default function ProjectDetail() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/dashboard"); }, []);
  return null;
}
