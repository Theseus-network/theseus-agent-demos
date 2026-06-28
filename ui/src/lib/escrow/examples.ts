// Example deals for the escrow product demo. Each is judgeable from the text
// itself (no live URLs required), and the set spans the three outcomes so the
// arbiter + Sentinel appeal flow is visible: a clean release, a clear refund,
// and a genuinely contested one where the honest answer is "can't tell."
export interface ExampleDeal {
  id: number;
  title: string;
  buyer: string;
  seller: string;
  amountLabel: string;
  category: string;
  spec: string;
  delivery: string;
}

export const EXAMPLE_DEALS: ExampleDeal[] = [
  {
    id: 9001,
    title: "Python weather helper",
    buyer: "0xA1…buyer",
    seller: "0xB2…dev",
    amountLabel: "1,200 eUSDC",
    category: "Code",
    spec: "Write a Python function get_weather(city) that calls the OpenWeather API and returns the current temperature in Celsius. It must handle an invalid/unknown city by raising a clear ValueError, include a docstring, and show one usage example.",
    delivery: `import requests

def get_weather(city: str) -> float:
    """Return the current temperature in Celsius for a city via OpenWeather.

    Raises ValueError if the city is unknown.
    """
    r = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"q": city, "units": "metric", "appid": API_KEY},
        timeout=10,
    )
    if r.status_code == 404:
        raise ValueError(f"Unknown city: {city}")
    r.raise_for_status()
    return r.json()["main"]["temp"]

# Usage
print(get_weather("Tokyo"))  # -> 21.4`,
  },
  {
    id: 9002,
    title: "Three DeFi blog posts",
    buyer: "0xC3…brand",
    seller: "0xD4…writer",
    amountLabel: "900 eUSDC",
    category: "Content",
    spec: "Deliver 3 original, 800-word blog posts on DeFi topics. Each post must have a title and cite at least 3 sources.",
    delivery: `Here's a first draft to get started:

"What is DeFi?"
DeFi means decentralized finance. It lets people lend and borrow crypto without banks. It is built on Ethereum and other chains. It is still risky and not regulated. More coming soon.

(~70 words, will add the other two and sources later)`,
  },
  {
    id: 9003,
    title: "Make the site feel premium",
    buyer: "0xE5…founder",
    seller: "0xF6…studio",
    amountLabel: "2,500 eUSDC",
    category: "Design",
    spec: "Redesign the marketing site so it feels more premium and 'pops' more. Make it modern.",
    delivery: "Done — refreshed the color palette to a darker theme, increased the spacing, and added some scroll animations. Pushed to the staging site for review.",
  },
];
