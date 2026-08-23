import { notFound } from "next/navigation";
import { HappyOysterWorldLab } from "@/components/HappyOysterWorldLab";

export default function WorldLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HappyOysterWorldLab />;
}
