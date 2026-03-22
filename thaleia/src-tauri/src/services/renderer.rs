use crate::models::document::{RenderedDocument, TocEntry};
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use regex::Regex;

pub struct MarkdownRenderer;

impl MarkdownRenderer {
    pub fn render(markdown: &str, path: &str, category: Option<&str>) -> RenderedDocument {
        let title = Self::extract_title(markdown).unwrap_or_else(|| {
            std::path::Path::new(path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });

        let toc = Self::extract_toc(markdown);
        let html = Self::to_html(markdown);

        RenderedDocument {
            path: path.to_string(),
            title,
            html,
            toc,
            category: category.map(|s| s.to_string()),
        }
    }

    fn extract_title(markdown: &str) -> Option<String> {
        let options = Options::all();
        let parser = Parser::new_ext(markdown, options);
        let mut in_heading = false;
        let mut title = String::new();

        for event in parser {
            match event {
                Event::Start(Tag::Heading { level: HeadingLevel::H1, .. }) => {
                    in_heading = true;
                }
                Event::Text(text) if in_heading => {
                    title.push_str(&text);
                }
                Event::End(TagEnd::Heading(HeadingLevel::H1)) => {
                    if !title.is_empty() {
                        return Some(title);
                    }
                    in_heading = false;
                }
                _ => {}
            }
        }
        None
    }

    fn extract_toc(markdown: &str) -> Vec<TocEntry> {
        let options = Options::all();
        let parser = Parser::new_ext(markdown, options);
        let mut toc = Vec::new();
        let mut current_heading_level: Option<u32> = None;
        let mut current_text = String::new();

        for event in parser {
            match event {
                Event::Start(Tag::Heading { level, .. }) => {
                    current_heading_level = Some(heading_level_to_u32(level));
                    current_text.clear();
                }
                Event::Text(text) if current_heading_level.is_some() => {
                    current_text.push_str(&text);
                }
                Event::End(TagEnd::Heading(_)) => {
                    if let Some(level) = current_heading_level.take() {
                        let anchor = slugify(&current_text);
                        toc.push(TocEntry {
                            level,
                            title: current_text.clone(),
                            anchor,
                        });
                    }
                }
                _ => {}
            }
        }

        toc
    }

    fn to_html(markdown: &str) -> String {
        let options = Options::all();
        let parser = Parser::new_ext(markdown, options);

        let mut html_output = String::new();
        pulldown_cmark::html::push_html(&mut html_output, parser);

        // Add anchor IDs to headings
        let heading_re = Regex::new(r"<h(\d)>(.*?)</h\d>").unwrap();
        let html_output = heading_re.replace_all(&html_output, |caps: &regex::Captures| {
            let level = &caps[1];
            let content = &caps[2];
            let anchor = slugify(content);
            format!(
                r#"<h{} id="{}" class="thaleia-h{}">{}</h{}>"#,
                level, anchor, level, content, level
            )
        });

        html_output.to_string()
    }
}

fn heading_level_to_u32(level: HeadingLevel) -> u32 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

fn slugify(text: &str) -> String {
    let stripped = Regex::new(r"<[^>]+>")
        .unwrap()
        .replace_all(text, "")
        .to_string();

    stripped
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
