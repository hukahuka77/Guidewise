import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Features from "@/components/custom/Features";
import Pricing from "@/components/custom/Pricing";
import About from "@/components/custom/About";
import Contact from "@/components/custom/Contact";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gray-100">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-gray-800">
                    Create Beautiful Guest Guidebooks in Minutes
                  </h1>
                  <p className="max-w-[600px] text-gray-500 md:text-xl">
                    Welcome your guests with a professional, AI-powered guidebook. No design skills needed. Impress your guests and get better reviews.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/create">
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Get Started for Free
                    </Button>
                  </Link>
                  <Link href="#">
                    <Button size="lg" variant="outline">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
              <Image
                alt="Hero Guidebook Cover"
                className="mx-auto aspect-[3/4] overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
                height={550}
                src="/coverimage.webp"
                width={550}
              />
            </div>
          </div>
        </section>
        <Features />
        <Pricing />
        <About />
        <Contact />
      </main>
    </div>
  );
}
