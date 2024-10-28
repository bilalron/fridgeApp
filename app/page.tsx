"use client";

import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FaIcon from 'react-icons/fa'; // Import all FontAwesome icons
import * as GiIcon from 'react-icons/gi';
import * as LuIcon from 'react-icons/lu';
import pluralize from 'pluralize';

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [nutritionalFacts, setNutritionalFacts] = useState<string | null>(null);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [modalOpen, setModalOpen] = useState(false); // For nutritional facts modal
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [recipeSuggestions, setRecipeSuggestions] = useState<string[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false); // Control for showing recipes
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Error message state
  const [canGenerateRecipes, setCanGenerateRecipes] = useState(false); // Controls if recipes can be generated

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      setErrorMessage(null); // Reset error message when a new image is uploaded
      setCanGenerateRecipes(false); // Disable recipe generation until fridge is identified
    }
  };

  const identifyFridgeItems = async () => {
    if (!image) return;

    setLoading(true);
    setShowResults(false);
    setErrorMessage(null); // Reset any previous error message

    const genAI = new GoogleGenerativeAI(
      process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY!
    );
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const imageParts = await fileToGenerativePart(image);
      const result = await model.generateContent([
        `Identify all the food items in the fridge. List as many as possible with only the name of the food. If the image is too blurry or not a fridge say This image is too blurry or This is not a fridge`,
        imageParts,
      ]);

      const response = await result.response;
      const text = response
        .text()
        .trim()
        .replace(/```/g, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "") // Remove asterisks
        .replace(/-\s*/g, "")
        .replace(/\n\s*\n/g, "\n");

      const itemsList = text
        .split("\n")
        .filter((item) => item.trim() !== "")
        .map((line) => line.trim());

      // Check if no items were identified or if the image quality was too poor
      if (itemsList.includes("This image is too blurry") || itemsList.includes("This is not a fridge")) {
        setErrorMessage("The image is either too blurry or does not appear to be a fridge. Please try again with a clearer image.");
      } else {
        setItems(itemsList);
        setShowResults(true);
        setCanGenerateRecipes(true); // Allow recipe generation once fridge is identified
      }
    } catch (error) {
      console.error("Error identifying fridge items:", error);
      setErrorMessage("An error occurred while processing the image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const capitalizeWords = (str: string) => {
    return str
      .toLowerCase() // Make the entire string lowercase first
      .split(' ') // Split into an array of words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
      .join(' '); // Join the words back together
  };

  const fetchNutritionalFacts = async (item: string) => {
    setLoadingFacts(true);

    const genAI = new GoogleGenerativeAI(
      process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY!
    );
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const result = await model.generateContent([
        `Provide nutritional facts for ${item} with only the categories listed below. Do not generate anything else:

        Calories: (Must be number or approximate)cal
        Fat: (Must be number or approximate)g
        Sodium: (Must be number or approximate)mg
        Carbohydrates: (Must be number or approximate)g
        Fiber: (Must be number or approximate)g
        Protein: (Must be number or approximate)g
        Note: This is a general guideline. Always check the nutrition label for the specific brand and variety of ${item} you are using.
        `,
      ]);

      const response = await result.response;
      let nutritionalInfo = response.text().trim();

      // Remove hashtags (#) and asterisks (*) from the result
      nutritionalInfo = nutritionalInfo.replace(/[#*]/g, '');

      // Ensure that there's a space after each colon
      nutritionalInfo = nutritionalInfo.replace(/:\s*/g, ': ');

      // Capitalize item name
      const capitalizedItem = capitalizeWords(item);

      // Check if any essential nutritional categories are missing, and add 'N/A' placeholders
      if (!nutritionalInfo.includes('Calories:')) nutritionalInfo += '\nCalories: N/A';
      if (!nutritionalInfo.includes('Fat:')) nutritionalInfo += '\nFat: N/A';
      if (!nutritionalInfo.includes('Sodium:')) nutritionalInfo += '\nSodium: N/A';
      if (!nutritionalInfo.includes('Carbohydrates:')) nutritionalInfo += '\nCarbohydrates: N/A';
      if (!nutritionalInfo.includes('Fiber:')) nutritionalInfo += '\nFiber: N/A';
      if (!nutritionalInfo.includes('Protein:')) nutritionalInfo += '\nProtein: N/A';

      setNutritionalFacts(`${nutritionalInfo}`);
      setSelectedItem(capitalizedItem);
      setModalOpen(true); // Open the modal after fetching the data
    } catch (error) {
      console.error("Error fetching nutritional facts:", error);
      setNutritionalFacts("Error fetching nutritional facts.");
    } finally {
      setLoadingFacts(false);
    }
  };

  const fetchRecipeSuggestions = async () => {
    setLoadingRecipes(true);
    const genAI = new GoogleGenerativeAI(
      process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY!
    );
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const result = await model.generateContent([
        `Suggest 3 recipes that can be made using the following items: ${items.join(
          ", "
        )}. For each recipe, provide the name, a short description, ingredients, and the instructions. For the instructions dont use numbers use words like First second`,
      ]);

      const response = await result.response;
      let recipes = response.text().trim().replace(/\*/g, ""); // Remove asterisks

      // Split each recipe block based on numbered format (e.g., "1.", "2.", etc.)
      const recipeList = recipes.split(/\d+\.\s+/).slice(1); // Skip the first empty block
      setRecipeSuggestions(recipeList);
      setShowRecipes(true); // Show recipes section
    } catch (error) {
      console.error("Error fetching recipe suggestions:", error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setNutritionalFacts(null); // Reset nutritional facts on close
  };

  // Helper function to format nutritional facts
  const formatNutritionalFacts = (facts: string) => {
    return facts
      .split("\n")
      .filter(line => line.trim() !== "")
      .map((line, index) => {
        const [key, value] = line.split(":");
        return (
          <div key={index} className="flex justify-between py-2">
            <span className="font-bold">{key.trim()}:</span>
            <span>{value ? value.trim() : "N/A"}</span>
          </div>
        );
      });
  };

  async function fileToGenerativePart(file: File): Promise<{
    inlineData: { data: string; mimeType: string };
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(",")[1];
        resolve({
          inlineData: {
            data: base64Content,
            mimeType: file.type,
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const getFoodIcon = (item: string) => {
    const singularItem = pluralize.singular(item);
    const formattedItemName = singularItem
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    const faIconName = `Fa${formattedItemName}`;
    const giIconName = `Gi${formattedItemName}`;
    const luIconName = `Lu${formattedItemName}`;

    const FaIconComponent = FaIcon[faIconName as keyof typeof FaIcon];
    const GiIconComponent = GiIcon[giIconName as keyof typeof GiIcon];
    const LuIconComponent = LuIcon[luIconName as keyof typeof LuIcon];

    return FaIconComponent 
      ? <FaIconComponent /> 
      : (GiIconComponent 
        ? <GiIconComponent /> 
        : (LuIconComponent ? <LuIconComponent /> : <FaIcon.FaLeaf />));
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-green-100 to-blue-100">
      {/* Centered Green-themed Header with Oswald Font */}
      <header className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-center items-center">
          <h1 className="text-5xl font-extrabold tracking-wider text-center font-[Oswald]">
            Fridge Item Identifier
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-12 px-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-10 text-center">
            <h2 className="text-4xl font-bold text-gray-800 mb-6 font-[Oswald]">
              Discover Items in Your Fridge & Get Nutritional Facts
            </h2>

            <div className="mb-6">
              <label
                htmlFor="image-upload"
                className="block text-lg font-medium text-gray-700 mb-4"
              >
                Upload an image of your fridge
              </label>

              <div className="relative cursor-pointer">
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 shadow-lg transition duration-200 ease-in-out">
                  <div className="flex flex-col items-center justify-center">
                  <svg
                      version="1.0"
                      xmlns="http://www.w3.org/2000/svg"
                      width="100px"
                      height="100px"
                      viewBox="0 0 626.000000 626.000000"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <g
                        transform="translate(0.000000,626.000000) scale(0.100000,-0.100000)"
                        fill="#000000"
                        stroke="none"
                      >
                        <path d="M1964 5909 c-18 -5 -46 -25 -63 -44 l-31 -36 0 -1029 0 -1030 1260 0 1260 0 -2 1034 -3 1035 -29 30 c-17 17 -46 36 -65 41 -46 13 -2283 12 -2327 -1z m300 -740 l26 -20 0 -334 c0 -331 0 -334 -22 -355 -29 -27 -54 -25 -83 5 l-25 24 0 326 0 326 25 24 c29 30 45 31 79 4z" />
                        <path d="M1870 3568 l0 -108 329 0 330 0 113 91 c62 51 121 99 130 108 16 15 -20 16 -442 16 l-460 0 0 -107z" />
                        <path d="M3630 3670 l-756 -5 -159 -147 -160 -148 -345 0 -345 0 5 -1377 c4 -1018 8 -1383 17 -1398 6 -11 23 -31 38 -45 24 -23 35 -25 136 -28 l109 -4 0 -89 0 -90 88 3 87 3 3 88 3 87 779 0 779 0 3 -87 3 -88 88 -3 87 -3 0 90 0 89 109 4 c105 3 111 4 140 32 16 15 34 40 40 55 8 18 10 473 9 1546 l-3 1520 -755 -5z" />
                      </g>
                    </svg>
                    <span className="text-lg font-medium text-green-600">
                      Drag & drop or click to upload
                    </span>
                    <span className="text-gray-500 mt-2">
                      Only JPEG, PNG, and GIF files allowed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {image && (
              <div className="mb-6 flex justify-center">
                <img
                  src={URL.createObjectURL(image)}
                  alt="Uploaded image"
                  className="rounded-lg shadow-lg"
                  style={{ width: "350px", height: "350px" }}
                />
              </div>
            )}

            {errorMessage && (
              <div className="text-red-600 font-semibold mb-4">
                {errorMessage}
              </div>
            )}

            <button
              onClick={identifyFridgeItems}
              disabled={!image || loading}
              className="w-full bg-green-600 text-white py-4 px-8 rounded-lg hover:bg-green-700 transition font-semibold text-lg"
            >
              {loading ? "Identifying..." : "Identify Items"}
            </button>

            {loading && (
              <div className="flex justify-center items-center mt-6">
                <div className="loader"></div>
              </div>
            )}

            {showResults && (
              <>
                <div className="bg-blue-100 p-6 border-t mt-8 fade-in">
                  <h3 className="text-2xl font-bold text-blue-900 mb-4">
                    Items in Your Fridge:
                  </h3>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => fetchNutritionalFacts(item)}
                        className="relative cursor-pointer px-4 py-2 bg-green-600 text-white rounded-full shadow-md flex items-center space-x-2 transform transition-all hover:scale-105 hover:bg-green-500 group"
                      >
                        <span className="text-xl">{getFoodIcon(item)}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Button to Recommend Recipes */}
                <div className="mt-8">
                  <button
                    onClick={fetchRecipeSuggestions}
                    disabled={loadingRecipes || !canGenerateRecipes}
                    className={`w-full py-4 px-8 rounded-lg transition font-semibold text-lg ${loadingRecipes || !canGenerateRecipes ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  >
                    {loadingRecipes ? "Generating Recipes..." : "Recommend Recipes"}
                  </button>
                </div>
              </>
            )}

            {/* Animated Recipe Suggestions */}
            {showRecipes && (
              <div className="mt-12 fade-in-recipe">
                <h3 className="text-2xl font-bold text-green-900 mb-4 text-center font-[Oswald]">
                  Recipe Suggestions
                </h3>
                <div className="flex flex-col items-center space-y-4">
                  {recipeSuggestions.map((recipe, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-pink-100 via-blue-100 to-green-100 shadow-lg rounded-lg p-4 w-full max-w-md"
                    >
                      {/* Render each recipe block as plain text */}
                      <p className="text-lg text-gray-800" style={{ whiteSpace: 'pre-line' }}>{recipe}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
                <div className="bg-white p-6 rounded-lg shadow-lg relative max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <button
                    className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
                    onClick={closeModal}
                  >
                    &times;
                  </button>
                  <h3 className="text-2xl font-bold text-blue-900 mb-4 text-center">
                    Nutritional Facts for {selectedItem}
                  </h3>
                  {loadingFacts ? (
                    <div className="loader"></div>
                  ) : (
                    <div className="text-left">
                      <div className="text-center font-bold mb-4">
                        {selectedItem} Nutritional Facts (per 1/2 cup)
                      </div>
                      {nutritionalFacts
                        ? formatNutritionalFacts(nutritionalFacts)
                        : <p>No nutritional information available.</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-5xl mx-auto text-center">
          <p className="mb-4">&copy; 2024 Fridge Item Identifier. All rights reserved.</p>
        </div>
      </footer>

      <style jsx>{`
        .fade-in {
          animation: fadeIn 1s ease-in-out;
        }

        .fade-in-recipe {
          animation: fadeIn 1.5s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .loader {
          border: 6px solid #f3f3f3;
          border-top: 6px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
