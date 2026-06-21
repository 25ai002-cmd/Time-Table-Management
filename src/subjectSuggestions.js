/**
 * Returns a list of suggested subject names for a given standard/class name.
 * Used in SubjectsSetup for quick-add chips and "Add All" functionality.
 */
export function getSubjectSuggestions(stdName = "", streamOverride = "auto") {
  let name = stdName.toLowerCase();

  // If there's a stream override, inject it into the matched name string
  if (streamOverride && streamOverride !== "auto") {
    name += " " + streamOverride.toLowerCase();
  }

  if (name.includes("kg") || name.includes("kindergarten") || name.includes("nursery")) {
    return ["English", "Mathematics", "Rhymes", "Drawing", "General Knowledge", "Story Telling", "Craft", "Activity"];
  }

  if (name.includes("11") || name.includes("12") || name.includes("xi") || name.includes("xii") || name.includes("senior") || name.includes("junior college") || name.includes("jc")) {
    if (name.includes("science") || name.includes("sci") || name.includes("med") || name.includes("non-med"))
      return ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science", "Physical Education"];
    if (name.includes("commerce") || name.includes("com") || name.includes("comm"))
      return ["Accountancy", "Business Studies", "Economics", "English", "Mathematics", "Informatics Practices", "Physical Education"];
    if (name.includes("arts") || name.includes("art") || name.includes("humanities") || name.includes("hum"))
      return ["History", "Geography", "Political Science", "Economics", "Sociology", "Psychology", "English", "Physical Education"];
    return ["English", "Mathematics", "Physics", "Chemistry", "Biology", "Accountancy", "Business Studies", "Economics", "History", "Political Science"];
  }

  const highClasses = ["class 9","class 10","grade 9","grade 10"];
  if (highClasses.some(c => name.includes(c))) {
    return ["English", "Mathematics", "Physics", "Chemistry", "Biology", "History & Civics", "Geography", "Computer Applications", "Hindi", "Economics", "Physical Education"];
  }

  const middleClasses = ["class 6","class 7","class 8","grade 6","grade 7","grade 8"];
  if (middleClasses.some(c => name.includes(c))) {
    return ["English", "Mathematics", "Physics", "Chemistry", "Biology", "History & Civics", "Geography", "Computer Science", "Hindi", "Physical Education", "Art"];
  }

  const lowerClasses = ["class 1","class 2","class 3","class 4","class 5","grade 1","grade 2","grade 3","grade 4","grade 5"];
  if (lowerClasses.some(c => name.includes(c))) {
    return ["English", "Mathematics", "Science", "Social Studies", "EVS", "Art", "Hindi", "Computer Science", "Physical Education"];
  }

  if (name.includes("bsc") || name.includes("b.sc") || name.includes("fybsc") || name.includes("sybsc") || name.includes("tybsc"))
    return ["Physics", "Chemistry", "Mathematics", "Zoology", "Botany", "Computer Science", "Statistics", "English"];
  if (name.includes("bcom") || name.includes("b.com") || name.includes("fybcom") || name.includes("sybcom") || name.includes("tybcom"))
    return ["Financial Accounting", "Business Law", "Microeconomics", "Business Mathematics", "Corporate Accounting", "Auditing", "Income Tax", "English"];
  if (name.includes("ba") || name.includes("b.a") || name.includes("fyba") || name.includes("syba") || name.includes("tyba") || name.includes("arts"))
    return ["English Literature", "Political Science", "Sociology", "History", "Psychology", "Economics", "Philosophy"];
  if (name.includes("bba") || name.includes("mba") || name.includes("fybba") || name.includes("sybba") || name.includes("tybba") || name.includes("business") || name.includes("management"))
    return ["Principles of Management", "Marketing Management", "Financial Management", "Human Resource Management", "Organizational Behavior", "Business Communication", "Economics"];
  if (name.includes("bca") || name.includes("mca") || name.includes("fybca") || name.includes("sybca") || name.includes("tybca") || name.includes("b.tech") || name.includes("m.tech") || name.includes("engineering") || name.includes("computer") || name.includes("it"))
    return ["Programming in C/C++", "Data Structures", "Database Management Systems", "Operating Systems", "Software Engineering", "Computer Networks", "Web Technologies", "Mathematics", "Digital Electronics"];
  if (name.includes("diploma") || name.includes("polytechnic"))
    return ["Engineering Mathematics", "Applied Physics", "Applied Chemistry", "Basic Engineering Drawing", "Workshop Practice", "Core Technical Subject 1", "Core Technical Subject 2"];

  // Coaching / Foundation
  if (name.includes("jee") || name.includes("iit"))
    return ["Physics", "Chemistry", "Mathematics"];
  if (name.includes("neet"))
    return ["Physics", "Chemistry", "Biology"];
  if (name.includes("cat") || name.includes("mba") || name.includes("upsc"))
    return ["Quantitative Aptitude", "Verbal Ability", "Logical Reasoning", "General Awareness", "Data Interpretation"];
  if (name.includes("gate"))
    return ["General Aptitude", "Engineering Mathematics", "Technical Subject"];

  // Default
  return ["English", "Mathematics", "Science", "Social Studies", "Hindi", "Computer Science", "Art", "Physical Education"];
}
