import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PushOptInBanner } from "@/components/push/PushOptInBanner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  Building2,
  Globe,
  Sparkles,
  MapPin,
  Users,
  Calculator,
  Megaphone,
  UserCheck,
  ArrowRight,
  Check,
  UserCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AgentTeamSelector } from "@/components/onboarding/AgentTeamSelector";
import { BusinessStageSelector } from "@/components/onboarding/BusinessStageSelector";
import { IntegrationSetup } from "@/components/onboarding/IntegrationSetup";
import { AgentChatView } from "@/components/chat/AgentChatView";

interface ConversationalOnboardingProps {
  userId: string;
  userEmail: string;
  onComplete: () => void;
}

type Step =
  | "welcome"
  | "business_name"
  | "website"
  | "business_stage"
  | "industry"
  | "location"
  | "description"
  | "meet_team"
  | "validator_personal_assistant"
  | "validator_accountant"
  | "validator_marketer"
  | "validator_sales"
  | "agent_team_selector"
  | "integration_setup"
  | "briefing"
  | "push_opt_in";

interface Validator {
  name: string;
  position: string;
  email: string;
  isSelf: boolean;
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

const countryData: Record<string, string[]> = {
  Afghanistan: ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif", "Other"],
  Albania: ["Tirana", "Durrës", "Vlorë", "Shkodër", "Other"],
  Algeria: ["Algiers", "Oran", "Constantine", "Annaba", "Other"],
  Andorra: ["Andorra la Vella", "Other"],
  Angola: ["Luanda", "Huambo", "Lobito", "Benguela", "Other"],
  "Antigua and Barbuda": ["St. John's", "Other"],
  Argentina: [
    "Buenos Aires",
    "Córdoba",
    "Rosario",
    "Mendoza",
    "La Plata",
    "Other",
  ],
  Armenia: ["Yerevan", "Gyumri", "Vanadzor", "Other"],
  Australia: [
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Gold Coast",
    "Canberra",
    "Newcastle",
    "Hobart",
    "Darwin",
    "Other",
  ],
  Austria: ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Other"],
  Azerbaijan: ["Baku", "Ganja", "Sumqayit", "Other"],
  Bahamas: ["Nassau", "Freeport", "Other"],
  Bahrain: ["Manama", "Riffa", "Muharraq", "Other"],
  Bangladesh: ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet", "Other"],
  Barbados: ["Bridgetown", "Other"],
  Belarus: ["Minsk", "Gomel", "Mogilev", "Vitebsk", "Other"],
  Belgium: ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Other"],
  Belize: ["Belmopan", "Belize City", "Other"],
  Benin: ["Porto-Novo", "Cotonou", "Other"],
  Bhutan: ["Thimphu", "Phuntsholing", "Other"],
  Bolivia: ["La Paz", "Santa Cruz", "Cochabamba", "Sucre", "Other"],
  "Bosnia and Herzegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Other"],
  Botswana: ["Gaborone", "Francistown", "Other"],
  Brazil: [
    "São Paulo",
    "Rio de Janeiro",
    "Brasília",
    "Salvador",
    "Fortaleza",
    "Belo Horizonte",
    "Manaus",
    "Curitiba",
    "Recife",
    "Porto Alegre",
    "Other",
  ],
  Brunei: ["Bandar Seri Begawan", "Other"],
  Bulgaria: ["Sofia", "Plovdiv", "Varna", "Burgas", "Other"],
  "Burkina Faso": ["Ouagadougou", "Bobo-Dioulasso", "Other"],
  Burundi: ["Gitega", "Bujumbura", "Other"],
  Cambodia: ["Phnom Penh", "Siem Reap", "Battambang", "Other"],
  Cameroon: ["Yaoundé", "Douala", "Other"],
  Canada: [
    "Toronto",
    "Montreal",
    "Vancouver",
    "Calgary",
    "Edmonton",
    "Ottawa",
    "Winnipeg",
    "Quebec City",
    "Hamilton",
    "Halifax",
    "Other",
  ],
  "Cape Verde": ["Praia", "Mindelo", "Other"],
  "Central African Republic": ["Bangui", "Other"],
  Chad: ["N'Djamena", "Other"],
  Chile: ["Santiago", "Valparaíso", "Concepción", "La Serena", "Other"],
  China: [
    "Shanghai",
    "Beijing",
    "Guangzhou",
    "Shenzhen",
    "Chengdu",
    "Hangzhou",
    "Wuhan",
    "Xi'an",
    "Nanjing",
    "Tianjin",
    "Other",
  ],
  Colombia: [
    "Bogotá",
    "Medellín",
    "Cali",
    "Barranquilla",
    "Cartagena",
    "Other",
  ],
  Comoros: ["Moroni", "Other"],
  "Congo (Brazzaville)": ["Brazzaville", "Pointe-Noire", "Other"],
  "Congo (DRC)": ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Other"],
  "Costa Rica": ["San José", "Limón", "Alajuela", "Other"],
  Croatia: ["Zagreb", "Split", "Rijeka", "Osijek", "Other"],
  Cuba: ["Havana", "Santiago de Cuba", "Camagüey", "Other"],
  Cyprus: ["Nicosia", "Limassol", "Larnaca", "Other"],
  "Czech Republic": ["Prague", "Brno", "Ostrava", "Plzeň", "Other"],
  Denmark: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Other"],
  Djibouti: ["Djibouti", "Other"],
  Dominica: ["Roseau", "Other"],
  "Dominican Republic": ["Santo Domingo", "Santiago", "Other"],
  Ecuador: ["Quito", "Guayaquil", "Cuenca", "Other"],
  Egypt: ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Other"],
  "El Salvador": ["San Salvador", "Santa Ana", "Other"],
  "Equatorial Guinea": ["Malabo", "Bata", "Other"],
  Eritrea: ["Asmara", "Other"],
  Estonia: ["Tallinn", "Tartu", "Other"],
  Eswatini: ["Mbabane", "Manzini", "Other"],
  Ethiopia: ["Addis Ababa", "Dire Dawa", "Other"],
  Fiji: ["Suva", "Nadi", "Other"],
  Finland: ["Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Other"],
  France: [
    "Paris",
    "Marseille",
    "Lyon",
    "Toulouse",
    "Nice",
    "Nantes",
    "Strasbourg",
    "Bordeaux",
    "Lille",
    "Rennes",
    "Other",
  ],
  Gabon: ["Libreville", "Port-Gentil", "Other"],
  Gambia: ["Banjul", "Serekunda", "Other"],
  Georgia: ["Tbilisi", "Batumi", "Kutaisi", "Other"],
  Germany: [
    "Berlin",
    "Hamburg",
    "Munich",
    "Cologne",
    "Frankfurt",
    "Stuttgart",
    "Düsseldorf",
    "Leipzig",
    "Dortmund",
    "Essen",
    "Other",
  ],
  Ghana: ["Accra", "Kumasi", "Tamale", "Other"],
  Greece: ["Athens", "Thessaloniki", "Patras", "Heraklion", "Other"],
  Grenada: ["St. George's", "Other"],
  Guatemala: ["Guatemala City", "Mixco", "Villa Nueva", "Other"],
  Guinea: ["Conakry", "Other"],
  "Guinea-Bissau": ["Bissau", "Other"],
  Guyana: ["Georgetown", "Other"],
  Haiti: ["Port-au-Prince", "Cap-Haïtien", "Other"],
  Honduras: ["Tegucigalpa", "San Pedro Sula", "Other"],
  Hungary: ["Budapest", "Debrecen", "Szeged", "Miskolc", "Other"],
  Iceland: ["Reykjavik", "Other"],
  India: [
    "Mumbai",
    "Delhi",
    "Bangalore",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Pune",
    "Jaipur",
    "Lucknow",
    "Other",
  ],
  Indonesia: [
    "Jakarta",
    "Surabaya",
    "Bandung",
    "Medan",
    "Semarang",
    "Makassar",
    "Other",
  ],
  Iran: ["Tehran", "Mashhad", "Isfahan", "Karaj", "Shiraz", "Other"],
  Iraq: ["Baghdad", "Basra", "Mosul", "Erbil", "Other"],
  Ireland: ["Dublin", "Cork", "Limerick", "Galway", "Other"],
  Israel: ["Jerusalem", "Tel Aviv", "Haifa", "Rishon LeZion", "Other"],
  Italy: [
    "Rome",
    "Milan",
    "Naples",
    "Turin",
    "Palermo",
    "Genoa",
    "Bologna",
    "Florence",
    "Venice",
    "Other",
  ],
  "Ivory Coast": ["Abidjan", "Yamoussoukro", "Other"],
  Jamaica: ["Kingston", "Montego Bay", "Other"],
  Japan: [
    "Tokyo",
    "Osaka",
    "Yokohama",
    "Nagoya",
    "Sapporo",
    "Kobe",
    "Kyoto",
    "Fukuoka",
    "Kawasaki",
    "Hiroshima",
    "Other",
  ],
  Jordan: ["Amman", "Zarqa", "Irbid", "Other"],
  Kazakhstan: ["Almaty", "Astana", "Shymkent", "Other"],
  Kenya: ["Nairobi", "Mombasa", "Kisumu", "Other"],
  Kiribati: ["Tarawa", "Other"],
  Kuwait: ["Kuwait City", "Hawalli", "Salmiya", "Other"],
  Kyrgyzstan: ["Bishkek", "Osh", "Other"],
  Laos: ["Vientiane", "Luang Prabang", "Other"],
  Latvia: ["Riga", "Daugavpils", "Other"],
  Lebanon: ["Beirut", "Tripoli", "Sidon", "Other"],
  Lesotho: ["Maseru", "Other"],
  Liberia: ["Monrovia", "Other"],
  Libya: ["Tripoli", "Benghazi", "Misrata", "Other"],
  Liechtenstein: ["Vaduz", "Other"],
  Lithuania: ["Vilnius", "Kaunas", "Klaipėda", "Other"],
  Luxembourg: ["Luxembourg City", "Other"],
  Madagascar: ["Antananarivo", "Toamasina", "Other"],
  Malawi: ["Lilongwe", "Blantyre", "Other"],
  Malaysia: ["Kuala Lumpur", "George Town", "Ipoh", "Johor Bahru", "Other"],
  Maldives: ["Malé", "Other"],
  Mali: ["Bamako", "Sikasso", "Other"],
  Malta: ["Valletta", "Other"],
  "Marshall Islands": ["Majuro", "Other"],
  Mauritania: ["Nouakchott", "Other"],
  Mauritius: ["Port Louis", "Other"],
  Mexico: [
    "Mexico City",
    "Guadalajara",
    "Monterrey",
    "Puebla",
    "Tijuana",
    "León",
    "Juárez",
    "Zapopan",
    "Mérida",
    "Cancún",
    "Other",
  ],
  Micronesia: ["Palikir", "Other"],
  Moldova: ["Chișinău", "Tiraspol", "Other"],
  Monaco: ["Monaco", "Other"],
  Mongolia: ["Ulaanbaatar", "Erdenet", "Other"],
  Montenegro: ["Podgorica", "Nikšić", "Other"],
  Morocco: ["Casablanca", "Rabat", "Fes", "Marrakech", "Tangier", "Other"],
  Mozambique: ["Maputo", "Matola", "Beira", "Other"],
  Myanmar: ["Yangon", "Mandalay", "Naypyidaw", "Other"],
  Namibia: ["Windhoek", "Walvis Bay", "Other"],
  Nauru: ["Yaren", "Other"],
  Nepal: ["Kathmandu", "Pokhara", "Lalitpur", "Other"],
  Netherlands: [
    "Amsterdam",
    "Rotterdam",
    "The Hague",
    "Utrecht",
    "Eindhoven",
    "Groningen",
    "Tilburg",
    "Almere",
    "Breda",
    "Nijmegen",
    "Other",
  ],
  "New Zealand": [
    "Auckland",
    "Wellington",
    "Christchurch",
    "Hamilton",
    "Tauranga",
    "Other",
  ],
  Nicaragua: ["Managua", "León", "Other"],
  Niger: ["Niamey", "Zinder", "Other"],
  Nigeria: ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Other"],
  "North Korea": ["Pyongyang", "Hamhung", "Other"],
  "North Macedonia": ["Skopje", "Bitola", "Other"],
  Norway: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Other"],
  Oman: ["Muscat", "Salalah", "Sohar", "Other"],
  Pakistan: [
    "Karachi",
    "Lahore",
    "Islamabad",
    "Faisalabad",
    "Rawalpindi",
    "Peshawar",
    "Other",
  ],
  Palau: ["Ngerulmud", "Other"],
  Palestine: ["Ramallah", "Gaza City", "Hebron", "Other"],
  Panama: ["Panama City", "Colón", "Other"],
  "Papua New Guinea": ["Port Moresby", "Lae", "Other"],
  Paraguay: ["Asunción", "Ciudad del Este", "Other"],
  Peru: ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Cusco", "Other"],
  Philippines: [
    "Manila",
    "Quezon City",
    "Davao",
    "Caloocan",
    "Cebu City",
    "Other",
  ],
  Poland: ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Other"],
  Portugal: ["Lisbon", "Porto", "Amadora", "Braga", "Other"],
  Qatar: ["Doha", "Al Wakrah", "Other"],
  Romania: ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Other"],
  Russia: [
    "Moscow",
    "Saint Petersburg",
    "Novosibirsk",
    "Yekaterinburg",
    "Kazan",
    "Other",
  ],
  Rwanda: ["Kigali", "Other"],
  "Saint Kitts and Nevis": ["Basseterre", "Other"],
  "Saint Lucia": ["Castries", "Other"],
  "Saint Vincent and the Grenadines": ["Kingstown", "Other"],
  Samoa: ["Apia", "Other"],
  "San Marino": ["San Marino", "Other"],
  "São Tomé and Príncipe": ["São Tomé", "Other"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Other"],
  Senegal: ["Dakar", "Thiès", "Other"],
  Serbia: ["Belgrade", "Novi Sad", "Niš", "Other"],
  Seychelles: ["Victoria", "Other"],
  "Sierra Leone": ["Freetown", "Other"],
  Singapore: ["Singapore", "Other"],
  Slovakia: ["Bratislava", "Košice", "Prešov", "Other"],
  Slovenia: ["Ljubljana", "Maribor", "Other"],
  "Solomon Islands": ["Honiara", "Other"],
  Somalia: ["Mogadishu", "Hargeisa", "Other"],
  "South Africa": [
    "Johannesburg",
    "Cape Town",
    "Durban",
    "Pretoria",
    "Port Elizabeth",
    "Other",
  ],
  "South Korea": [
    "Seoul",
    "Busan",
    "Incheon",
    "Daegu",
    "Daejeon",
    "Gwangju",
    "Other",
  ],
  "South Sudan": ["Juba", "Other"],
  Spain: [
    "Madrid",
    "Barcelona",
    "Valencia",
    "Seville",
    "Zaragoza",
    "Málaga",
    "Murcia",
    "Palma",
    "Bilbao",
    "Other",
  ],
  "Sri Lanka": ["Colombo", "Kandy", "Galle", "Other"],
  Sudan: ["Khartoum", "Omdurman", "Other"],
  Suriname: ["Paramaribo", "Other"],
  Sweden: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Other"],
  Switzerland: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Other"],
  Syria: ["Damascus", "Aleppo", "Homs", "Other"],
  Taiwan: ["Taipei", "Kaohsiung", "Taichung", "Tainan", "Other"],
  Tajikistan: ["Dushanbe", "Khujand", "Other"],
  Tanzania: ["Dar es Salaam", "Mwanza", "Dodoma", "Other"],
  Thailand: ["Bangkok", "Chiang Mai", "Pattaya", "Phuket", "Other"],
  "Timor-Leste": ["Dili", "Other"],
  Togo: ["Lomé", "Other"],
  Tonga: ["Nukuʻalofa", "Other"],
  "Trinidad and Tobago": ["Port of Spain", "San Fernando", "Other"],
  Tunisia: ["Tunis", "Sfax", "Sousse", "Other"],
  Turkey: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Other"],
  Turkmenistan: ["Ashgabat", "Türkmenabat", "Other"],
  Tuvalu: ["Funafuti", "Other"],
  Uganda: ["Kampala", "Gulu", "Other"],
  Ukraine: ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Lviv", "Other"],
  "United Arab Emirates": [
    "Dubai",
    "Abu Dhabi",
    "Sharjah",
    "Al Ain",
    "Ajman",
    "Ras Al Khaimah",
    "Fujairah",
    "Other",
  ],
  "United Kingdom": [
    "London",
    "Birmingham",
    "Manchester",
    "Leeds",
    "Glasgow",
    "Liverpool",
    "Bristol",
    "Edinburgh",
    "Sheffield",
    "Newcastle",
    "Other",
  ],
  "United States": [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "San Jose",
    "Austin",
    "Miami",
    "Seattle",
    "Denver",
    "Boston",
    "Atlanta",
    "San Francisco",
    "Other",
  ],
  Uruguay: ["Montevideo", "Salto", "Other"],
  Uzbekistan: ["Tashkent", "Samarkand", "Bukhara", "Other"],
  Vanuatu: ["Port Vila", "Other"],
  "Vatican City": ["Vatican City", "Other"],
  Venezuela: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Other"],
  Vietnam: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Other"],
  Yemen: ["Sana'a", "Aden", "Taiz", "Other"],
  Zambia: ["Lusaka", "Kitwe", "Other"],
  Zimbabwe: ["Harare", "Bulawayo", "Other"],
};

const countries = Object.keys(countryData);

const agentInfo = {
  personal_assistant: {
    name: "Pat",
    role: "AI Personal Assistant",
    icon: UserCircle,
    description:
      "Reads your emails, scans your calendar, identifies priorities, and sends daily briefings",
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  accountant: {
    name: "Alex",
    role: "AI Accountant",
    icon: Calculator,
    description:
      "Tracks invoices, manages expenses, and generates financial reports",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  marketer: {
    name: "Maya",
    role: "AI Marketer",
    icon: Megaphone,
    description:
      "Creates social content, manages campaigns, and grows your brand",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  sales_rep: {
    name: "Sam",
    role: "AI Sales Rep",
    icon: Users,
    description:
      "Generates leads, writes outreach emails, and manages your pipeline",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
};

export const ConversationalOnboarding = ({
  userId,
  userEmail,
  onComplete,
}: ConversationalOnboardingProps) => {
  const [step, setStep] = useState<Step>("welcome");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [validators, setValidators] = useState<Record<string, Validator>>({
    personal_assistant: { name: "", position: "", email: "", isSelf: true },
    accountant: { name: "", position: "", email: "", isSelf: true },
    marketer: { name: "", position: "", email: "", isSelf: true },
    sales_rep: { name: "", position: "", email: "", isSelf: true },
  });
  const [businessStage, setBusinessStage] = useState<
    "starting" | "running" | "scaling" | ""
  >("");
  const [briefingProgress, setBriefingProgress] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  const { toast } = useToast();
  const { token } = useAuth();

  const availableCities = useMemo(() => {
    return country ? countryData[country] || ["Other"] : [];
  }, [country]);

  const totalSteps = 13;
  const currentStepNumber = {
    welcome: 0,
    business_name: 1,
    website: 2,
    business_stage: 3,
    industry: 4,
    location: 5,
    description: 6,
    meet_team: 7,
    validator_personal_assistant: 8,
    validator_accountant: 9,
    validator_marketer: 10,
    validator_sales: 11,
    agent_team_selector: 12,
    integration_setup: 13,
    briefing: 13,
    push_opt_in: 13,
  }[step];

  const progressPercent = (currentStepNumber / totalSteps) * 100;

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setCity("");
  };

  const updateValidator = (
    agentType: string,
    field: keyof Validator,
    value: string | boolean,
  ) => {
    setValidators((prev) => ({
      ...prev,
      [agentType]: { ...prev[agentType], [field]: value },
    }));
  };

  const setValidatorAsSelf = (agentType: string) => {
    setValidators((prev) => ({
      ...prev,
      [agentType]: {
        name: "Me",
        position: "Owner",
        email: userEmail,
        isSelf: true,
      },
    }));
  };

  const nextStep = () => {
    const steps: Step[] = [
      "welcome",
      "business_name",
      "website",
      "business_stage",
      "industry",
      "location",
      "description",
      "meet_team",
      "validator_personal_assistant",
      "validator_accountant",
      "validator_marketer",
      "validator_sales",
      "agent_team_selector",
      "integration_setup",
      "briefing",
      "push_opt_in",
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleTeamAccept = async (selectedIds: Set<string>) => {
    setIsAccepting(true);
    setStep("integration_setup");
    setBriefingProgress(10);
    try {
      const DEFAULT_IDS = [
        "chief_of_staff",
        "accountant",
        "marketer",
        "sales_rep",
        "personal_assistant",
      ];
      // Insert default 5 agents (upsert — idempotent via POST /api/user-agents)
      for (const agentTypeId of DEFAULT_IDS) {
        try {
          await api.post(
            "/api/user-agents",
            { agent_type_id: agentTypeId },
            { token },
          );
        } catch {
          // ignore conflict errors
        }
      }
      setBriefingProgress(40);
      // Insert selected additional agents (exclude defaults)
      const additionalIds = Array.from(selectedIds).filter(
        (id) => !DEFAULT_IDS.includes(id),
      );
      for (const agentTypeId of additionalIds) {
        try {
          await api.post(
            "/api/user-agents",
            { agent_type_id: agentTypeId },
            { token },
          );
        } catch {
          // ignore conflict errors
        }
      }
      setBriefingProgress(70);
      // Update profile: set onboarding_completed = true + all collected fields
      await api.patch(
        "/api/profiles/me",
        {
          business_name: businessName,
          industry,
          country,
          city,
          company_description: description,
          business_stage: businessStage || null,
          onboarding_completed: true,
        },
        { token },
      );
      setBriefingProgress(100);
      // Workspace personalization is handled server-side — skip client-side patch loop
      // Step advances via nextStep() from integration_setup -> briefing -> push_opt_in
      setIsAccepting(false);
    } catch (error: any) {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
      setStep("agent_team_selector");
      setIsAccepting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return (
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Welcome to Worryless AI</h1>
              <p className="text-muted-foreground text-lg">
                Let's set up your business and introduce you to your AI team
              </p>
            </div>
            <Button size="lg" onClick={nextStep} className="gap-2">
              Let's get started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        );

      case "business_name":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Building2 className="h-4 w-4" />
                <span>Step 1 of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">
                What's your business called?
              </h2>
            </div>
            <Input
              placeholder="Enter your business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="text-lg h-14"
              autoFocus
            />
            <Button
              onClick={nextStep}
              disabled={!businessName.trim()}
              className="w-full h-12"
            >
              Continue
            </Button>
          </div>
        );

      case "website":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Globe className="h-4 w-4" />
                <span>Step 2 of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">Do you have a website?</h2>
              <p className="text-muted-foreground">
                We'll analyze it to help your AI team understand your business
                better
              </p>
            </div>
            <Input
              placeholder="www.yourbusiness.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="text-lg h-14"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={nextStep}
                className="flex-1 h-12"
              >
                I don't have one
              </Button>
              <Button onClick={nextStep} className="flex-1 h-12">
                Continue
              </Button>
            </div>
          </div>
        );

      case "business_stage":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <BusinessStageSelector
              value={businessStage}
              onSelect={(stage) => {
                setBusinessStage(stage);
              }}
            />
            <Button
              onClick={nextStep}
              disabled={!businessStage}
              className="w-full h-12"
            >
              Continue
            </Button>
          </div>
        );

      case "industry":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Building2 className="h-4 w-4" />
                <span>Step 3 of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">
                What industry are you in?
              </h2>
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="text-lg h-14">
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
            <Button
              onClick={nextStep}
              disabled={!industry}
              className="w-full h-12"
            >
              Continue
            </Button>
          </div>
        );

      case "location":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4" />
                <span>Step 4 of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">Where are you based?</h2>
              <p className="text-muted-foreground">
                This helps us find relevant leads in your area
              </p>
            </div>
            <div className="space-y-3">
              <Select value={country} onValueChange={handleCountryChange}>
                <SelectTrigger className="text-lg h-14">
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
              <Select value={city} onValueChange={setCity} disabled={!country}>
                <SelectTrigger className="text-lg h-14">
                  <SelectValue
                    placeholder={
                      country ? "Select city" : "Select country first"
                    }
                  />
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
            <Button
              onClick={nextStep}
              disabled={!country || !city}
              className="w-full h-12"
            >
              Continue
            </Button>
          </div>
        );

      case "description":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Step 5 of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">
                Tell us about your business
              </h2>
              <p className="text-muted-foreground">
                What do you do? Who are your customers?
              </p>
            </div>
            <Textarea
              placeholder="We help small businesses..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="text-lg"
            />
            <Button onClick={nextStep} className="w-full h-12">
              Continue
            </Button>
          </div>
        );

      case "meet_team":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Users className="h-4 w-4" />
                <span>Step 6 of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">Meet your AI team</h2>
              <p className="text-muted-foreground">
                Three specialized agents ready to help grow {businessName}
              </p>
            </div>
            <div className="grid gap-4">
              {(
                Object.entries(agentInfo) as [
                  keyof typeof agentInfo,
                  (typeof agentInfo)[keyof typeof agentInfo],
                ][]
              ).map(([key, agent]) => {
                const Icon = agent.icon;
                return (
                  <div
                    key={key}
                    className={cn("p-4 rounded-xl border", agent.bgColor)}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-full flex items-center justify-center bg-background",
                          agent.color,
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{agent.name}</h3>
                          <span className="text-xs text-muted-foreground">
                            • {agent.role}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button onClick={nextStep} className="w-full h-12 gap-2">
              Set up approvals <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        );

      case "validator_personal_assistant":
      case "validator_accountant":
      case "validator_marketer":
      case "validator_sales":
        const agentTypeKey =
          step === "validator_sales"
            ? "sales_rep"
            : step === "validator_personal_assistant"
              ? "personal_assistant"
              : step.replace("validator_", "");
        const agentType = agentTypeKey as keyof typeof agentInfo;
        const agent = agentInfo[agentType];
        const validator = validators[agentType];
        const stepNum =
          step === "validator_personal_assistant"
            ? 7
            : step === "validator_accountant"
              ? 8
              : step === "validator_marketer"
                ? 9
                : 10;
        const Icon = agent.icon;

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <UserCheck className="h-4 w-4" />
                <span>Step {stepNum} of 9</span>
              </div>
              <h2 className="text-2xl font-semibold">
                Who validates {agent.name}'s work?
              </h2>
              <p className="text-muted-foreground">
                This person will review and approve important tasks from your{" "}
                {agent.role}
              </p>
            </div>

            <div
              className={cn(
                "p-4 rounded-xl border flex items-center gap-4",
                agent.bgColor,
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center bg-background",
                  agent.color,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.role}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                variant={validator.isSelf ? "default" : "outline"}
                className="w-full h-12 justify-start gap-3"
                onClick={() => setValidatorAsSelf(agentType)}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center",
                    validator.isSelf
                      ? "border-primary-foreground bg-primary-foreground"
                      : "border-muted-foreground",
                  )}
                >
                  {validator.isSelf && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                I'll handle this myself
              </Button>

              <Button
                variant={!validator.isSelf ? "default" : "outline"}
                className="w-full h-12 justify-start gap-3"
                onClick={() => updateValidator(agentType, "isSelf", false)}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center",
                    !validator.isSelf
                      ? "border-primary-foreground bg-primary-foreground"
                      : "border-muted-foreground",
                  )}
                >
                  {!validator.isSelf && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                Assign to a teammate
              </Button>

              {!validator.isSelf && (
                <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                  <Input
                    placeholder="Teammate's name"
                    value={validator.name}
                    onChange={(e) =>
                      updateValidator(agentType, "name", e.target.value)
                    }
                    className="h-12"
                  />
                  <Input
                    placeholder="Position (e.g., CFO, Marketing Lead)"
                    value={validator.position}
                    onChange={(e) =>
                      updateValidator(agentType, "position", e.target.value)
                    }
                    className="h-12"
                  />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={validator.email}
                    onChange={(e) =>
                      updateValidator(agentType, "email", e.target.value)
                    }
                    className="h-12"
                  />
                </div>
              )}
            </div>

            <Button
              onClick={nextStep}
              disabled={
                !validator.isSelf && (!validator.name || !validator.email)
              }
              className="w-full h-12"
            >
              Continue
            </Button>
          </div>
        );

      case "agent_team_selector":
        return (
          <AgentTeamSelector
            businessName={businessName}
            industry={industry}
            description={description}
            location={`${city}, ${country}`}
            onAccept={handleTeamAccept}
            isAccepting={isAccepting}
          />
        );

      case "integration_setup":
        return <IntegrationSetup onContinue={nextStep} />;

      case "briefing":
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                Your Chief of Staff is ready
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Here's your first briefing based on your business profile.
              </p>
            </div>
            <div className="h-[400px] border rounded-lg overflow-hidden">
              <AgentChatView agentType="chief_of_staff" userId={userId} />
            </div>
            <Button onClick={nextStep} className="w-full h-12">
              Go to Dashboard
            </Button>
          </div>
        );

      case "push_opt_in":
        return (
          <div className="flex flex-col items-center space-y-6 animate-in fade-in duration-300">
            <PushOptInBanner
              userId={userId}
              onDismiss={() => {
                localStorage.setItem("push_opt_in_shown", "1");
                onComplete();
              }}
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {step !== "welcome" && step !== "push_opt_in" && (
        <div className="w-full max-w-md mb-8">
          <Progress value={progressPercent} className="h-1" />
        </div>
      )}
      <div className="w-full max-w-md">{renderStep()}</div>
    </div>
  );
};
