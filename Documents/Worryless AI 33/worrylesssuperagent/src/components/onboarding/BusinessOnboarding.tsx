import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Building2, Globe, Sparkles, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BusinessOnboardingProps {
  userId: string;
  onComplete: () => void;
}

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Retail",
  "Manufacturing",
  "Real Estate",
  "Education",
  "Hospitality",
  "Professional Services",
  "Marketing & Advertising",
  "E-commerce",
  "Other",
];

// Countries and their major cities for lead generation
const countryData: Record<string, string[]> = {
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Miami", "Seattle", "Denver", "Boston", "Atlanta", "San Francisco", "Other"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Liverpool", "Bristol", "Edinburgh", "Sheffield", "Newcastle", "Other"],
  "Germany": ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Other"],
  "India": ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Pune", "Jaipur", "Lucknow", "Other"],
  "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Other"],
  "Canada": ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Halifax", "Other"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Newcastle", "Hobart", "Darwin", "Other"],
  "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Other"],
  "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Juárez", "Zapopan", "Mérida", "Cancún", "Other"],
  "Japan": ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Sapporo", "Kobe", "Kyoto", "Fukuoka", "Kawasaki", "Hiroshima", "Other"],
  "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre", "Other"],
  "Italy": ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Catania", "Venice", "Other"],
  "Spain": ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga", "Murcia", "Palma", "Bilbao", "Alicante", "Other"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London", "Polokwane", "Nelspruit", "Kimberley", "Other"],
  "Singapore": ["Singapore", "Other"],
  "Ireland": ["Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk", "Swords", "Bray", "Navan", "Other"],
  "Switzerland": ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Winterthur", "Lucerne", "St. Gallen", "Lugano", "Biel", "Other"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Other"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran", "Taif", "Tabuk", "Buraidah", "Other"],
  "Nigeria": ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Benin City", "Maiduguri", "Zaria", "Aba", "Jos", "Other"],
  "Other": ["Other"],
};

const countries = Object.keys(countryData);

export const BusinessOnboarding = ({ userId, onComplete }: BusinessOnboardingProps) => {
  const { token } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Get cities based on selected country
  const availableCities = useMemo(() => {
    return country ? countryData[country] || ["Other"] : [];
  }, [country]);

  // Reset city when country changes
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setCity("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      toast({
        title: "Business name required",
        description: "Please enter your business name",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({ title: "Not authenticated", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setProgress(10);
    setStatusMessage("Initializing...");

    try {
      // If website is provided, crawl it
      if (website.trim()) {
        setProgress(20);
        setStatusMessage("Discovering website pages...");

        // Ensure website has protocol
        let websiteUrl = website.trim();
        if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
          websiteUrl = 'https://' + websiteUrl;
        }

        setProgress(40);
        setStatusMessage("Analyzing website content...");

        const data = await api.post<{ artifactsCount?: number }>("/api/crawl-business-website", {
          websiteUrl,
          userId,
          businessName,
          industry,
          country,
          city,
          description,
        }, { token });

        setProgress(80);
        setStatusMessage("Building knowledge base...");

        if (data?.artifactsCount && data.artifactsCount > 0) {
          toast({
            title: "Knowledge base created!",
            description: `Successfully extracted ${data.artifactsCount} business artifacts from your website`,
          });
        }
      } else {
        // Just save basic info without crawling
        await api.patch("/api/profiles/me", {
          business_name: businessName,
          industry,
          country,
          city,
          company_description: description,
          onboarding_completed: true,
        }, { token });
      }

      setProgress(100);
      setStatusMessage("Complete!");

      toast({
        title: "Welcome aboard!",
        description: "Your business profile has been set up successfully",
      });

      onComplete();
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        title: "Setup failed",
        description: error.message || "Failed to set up your business profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!token) { onComplete(); return; }
    try {
      await api.patch("/api/profiles/me", { onboarding_completed: true }, { token });
      onComplete();
    } catch (error) {
      console.error('Skip error:', error);
      onComplete();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set up your business</CardTitle>
          <CardDescription>
            Tell us about your business so our AI agents can provide personalized assistance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                placeholder="Acme Inc."
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website URL
                </div>
              </Label>
              <Input
                id="website"
                placeholder="www.yourbusiness.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                We'll analyze your website to build a knowledge base for your AI agents
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select value={industry} onValueChange={setIndustry} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="country">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Country
                  </div>
                </Label>
                <Select value={country} onValueChange={handleCountryChange} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[200px]">
                    {countries.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Select
                  value={city}
                  onValueChange={setCity}
                  disabled={isLoading || !country}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={country ? "Select city" : "Select country first"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[200px]">
                    {availableCities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for lead generation targeting
            </p>

            <div className="space-y-2">
              <Label htmlFor="description">Brief Description</Label>
              <Textarea
                id="description"
                placeholder="What does your business do? Who are your customers?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            {isLoading && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">{statusMessage}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={handleSkip}
                disabled={isLoading}
              >
                Skip for now
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
