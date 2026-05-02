import axios from "axios";
import { env, type LuaTool } from "lua-cli";
import { z } from "zod";

const FOURSQUARE_PLACES_SEARCH_URL = "https://api.foursquare.com/v3/places/search";
const FOURSQUARE_FIELDS = [
    "fsq_id",
    "name",
    "location",
    "tel",
    "website",
    "link",
    "categories",
    "chains",
    "geocodes",
    "rating",
    "stats",
    "closed_bucket",
].join(",");

const findBusinessWebsitesInputSchema = z.object({
    businessQuery: z
        .string()
        .min(1)
        .describe("The type or name of business to search for, e.g. dentists, restaurants, accountants"),
    area: z
        .string()
        .min(1)
        .describe("The city, neighborhood, postcode, or area to search within"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of businesses to return. Foursquare Places Search supports up to 50."),
    includeBusinessesWithoutWebsite: z
        .boolean()
        .default(false)
        .describe("When true, include businesses even if Foursquare does not return a website URL."),
});

type FindBusinessWebsitesInput = z.infer<typeof findBusinessWebsitesInputSchema>;

type FoursquarePlace = {
    fsq_id?: string;
    name?: string;
    location?: {
        formatted_address?: string;
        address?: string;
        locality?: string;
        region?: string;
        postcode?: string;
        country?: string;
    };
    tel?: string;
    website?: string;
    link?: string;
    rating?: number;
    stats?: {
        total_ratings?: number;
        total_tips?: number;
        total_photos?: number;
    };
    closed_bucket?: string;
    categories?: Array<{
        id?: number;
        name?: string;
        short_name?: string;
        plural_name?: string;
    }>;
    geocodes?: {
        main?: {
            latitude?: number;
            longitude?: number;
        };
    };
};

type FoursquarePlacesSearchResponse = {
    results?: FoursquarePlace[];
};

export default class FindBusinessWebsitesTool implements LuaTool<typeof findBusinessWebsitesInputSchema> {
    name = "find_business_websites";

    description =
        "Find businesses in a specified area and return their website URLs and useful contact details.";

    inputSchema = findBusinessWebsitesInputSchema;

    async execute(input: FindBusinessWebsitesInput) {
        const apiKey = env("FOURSQUARE_API_KEY");

        if (!apiKey) {
            throw new Error(
                "Missing FOURSQUARE_API_KEY. Add a Foursquare Places API key before using find_business_websites."
            );
        }

        const limit = input.limit ?? 10;
        const includeBusinessesWithoutWebsite = input.includeBusinessesWithoutWebsite ?? false;

        try {
            const response = await axios.get<FoursquarePlacesSearchResponse>(
                FOURSQUARE_PLACES_SEARCH_URL,
                {
                    headers: {
                        Accept: "application/json",
                        Authorization: apiKey,
                    },
                    params: {
                        query: input.businessQuery,
                        near: input.area,
                        limit,
                        fields: FOURSQUARE_FIELDS,
                    },
                }
            );

            const places = response.data.results ?? [];
            const businesses = places
                .filter((place) => includeBusinessesWithoutWebsite || Boolean(place.website))
                .slice(0, limit)
                .map((place, index) => ({
                    rank: index + 1,
                    name: place.name ?? "Unknown business",
                    websiteUrl: place.website ?? null,
                    address: place.location?.formatted_address ?? null,
                    phoneNumber: place.tel ?? null,
                    foursquareUrl: formatFoursquareUrl(place.link, place.fsq_id),
                    rating: place.rating ?? null,
                    userRatingCount: place.stats?.total_ratings ?? null,
                    businessStatus: place.closed_bucket ?? null,
                    placeId: place.fsq_id ?? null,
                    categories: (place.categories ?? []).map((category) => category.name).filter(Boolean),
                    latitude: place.geocodes?.main?.latitude ?? null,
                    longitude: place.geocodes?.main?.longitude ?? null,
                }));

            return {
                query: input.businessQuery,
                area: input.area,
                provider: "foursquare",
                requestedLimit: limit,
                returnedCount: businesses.length,
                omittedBusinessesWithoutWebsite: includeBusinessesWithoutWebsite
                    ? 0
                    : places.length - businesses.length,
                businesses,
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                const details = error.response?.data;
                throw new Error(
                    `Foursquare Places request failed${status ? ` with status ${status}` : ""}: ${JSON.stringify(details ?? error.message)}`
                );
            }

            throw error;
        }
    }
}

function formatFoursquareUrl(link?: string, fsqId?: string) {
    if (link?.startsWith("http")) {
        return link;
    }

    if (link) {
        return `https://foursquare.com${link}`;
    }

    return fsqId ? `https://foursquare.com/v/${fsqId}` : null;
}
