import { items } from './items.js'
import { Lexer } from './lexer.js'

export function ParseText(text) {
    let lexer = new Lexer(text)
    lexer.run()
    let html = "";
    
    return (() => {
        let inOL = false;
        let inUL = false;
        
        lexer.items.forEach(item => {
            
            if (inOL === true && item.typ !== items.OrderedListItem) {
                inOL = false
                html += "</ol>"
            }
            if (inUL === true && item.typ !== items.UnorderedListItem) {
                inUL = false
                html += "</ul>"
            }
            
            switch (item.typ) {
                case items.Text: html += item.val; break
                case items.StartBold: html += "<b>"; break
                case items.EndBold: html += "</b>"; break
                case items.StartItalic: html += "<i>"; break
                case items.EndItalic: html += "</i>\n"; break
                case items.Linebreak: html += "\n<br/>\n"; break
                // case items.Newline: html += "\n"; break
                case items.H1: html += "<h1>"+ item.val +"</h1>\n"; break
                case items.H2: html += "<h2>"+ item.val +"</h2>\n"; break
                case items.H3: html += "<h3>"+ item.val +"</h3>\n"; break
                case items.Link: html += `<a href="${item.val.link}">`+ item.val.title +"</a>"; break
                case items.Img: html += `<img href="${item.val.link}" alt="${item.val.title}"/>`; break
                case items.CodeBlock: html += `<pre><code data-lang="${item.val.lang}">${item.val.code}</code></pre>`; break
                case items.Code: html += `<code>${item.val}</code>`; break
                
                // Lists
                case items.OrderedListItem: {
                    if (inOL === false) {
                        inOL = true;
                        html += "<ol>"
                    }
                    let val = ParseText(item.val)
                    html += "<li>"+ val +"</li>\n"
                    break
                }
                case items.UnorderedListItem: {
                    if (inUL === false) {
                        inUL = true;
                        html += "<ul>"
                    }
                    let val = ParseText(item.val)
                    html += "<li>"+ val +"</li>\n"
                    break
                }
            }
        })
        return html;
    })()
}