console.log('phase2-parser.js')
// This parser follows the technique presented in a talk by Rob Pike in August 2011.
// Lexical Scanning in Go - Rob Pike
// Talk: https://www.youtube.com/watch?v=HxaD_trXwRE
// Slides: https://talks.golang.org/2011/lex.slide#1

// I am just a beginner in this field, who is exploring what lexing and parsing
// is about, by building my own lexer and parser.
// This could help: https://github.github.com/gfm/#appendix-a-parsing-strategy

const eof = 0

// Tokens
const oneAstrisk = "*"      // italic
const twoAstrisks = "**"    // bold
// const threeAstrisks = "***" // italic+bold
const bang = "!"
const newline = "\n"
const linebreak = "\n\n"
const heading = "#"


// Item Types
const itemError = 0
const itemText = 1
const itemStartBold = 2
const itemEndBold = 3
const itemStartItalic = 4
const itemEndItalic = 5
const itemBang = 6
const itemEOF = 7
const itemNewline = 8
const itemLinebreak = 9
const itemitem = 10
const itemH1 = 11
const itemH2 = 12
const itemH3 = 13
const itemOrderedListItem = 14
const itemUnorderedListItem = 15

class Item {
    constructor(typ, val) {
        this.typ = typ
        this.val = val
    }

    String() {
        let typ = this.typ
        // switch (this.typ) {
        //     case itemError: typ = "Error"; break
        //     case itemText: typ = "Text"; break
        return `${this.val} <${typ}>`
    }
}

class Lexer {
    constructor(input) {
        this.input = input
        this.state = this.lexText
        this.items = []
        this.start = 0
        this.pos = 0
    }

    run() {
        for(let state = this.state; state != null;) {
            state = state.call(this)
        }
    }

    emit(typ) {
        if (this.start !== this.pos) {
            this.items.push(new Item(typ, this.input.substring(this.start, this.pos)))
            this.start = this.pos
        }
    }

    error(msg) {
        this.items.push(new Item(itemError, 'Lex error: ' + msg))
        return null;
    }

    // Next returns the next rune in the input.
    next() {
        this.pos++
        if (this.pos >= this.input.length) {
            return eof
        }
        return this.input[this.pos]
    }

    // igonre
    ignore() {
        this.start = this.pos
    }
    
    // backup steps back one rune.
    // Can be called only once per call of next.
    backup() {
        this.pos--
    }

    // peek returns but does not consume
    // the next rune in the input.
    peek() {
        const r = this.next()
        this.backup()
        return r
    }

    // accept peeks and determines if it belongs to a charset
    accept(charset) {
        let r = this.next() 
        if (charset.includes(r)) {
            return true
        }
        this.backup()
        return false
    }

    // acceptRun
    acceptRun(charset) {
        let r = this.next()
        while(charset.includes(r)) {
            r = this.next()
        }
        this.backup()
    }

    // pop backtracks.
    pop() {
        let i = this.items.pop()
        this.start -= i.val.length
    }


    lexText() {
        while(true) {
            const incomingText = this.input.substring(this.pos)
            if (incomingText.startsWith(twoAstrisks)) {
                this.emit(itemText)
                return this.lexStartBold

            } else if (incomingText.startsWith(oneAstrisk)) {
                this.emit(itemText)
                return this.lexStartItalic
            
            } else if (incomingText.startsWith(newline)) {
                this.emit(itemText)
                return this.lexNewline
                
            } else if (this.pos == 0 && incomingText.startsWith(heading)) {
                return this.lexHeading
            }
            
            const r = this.next()
            switch(r) {
                case eof: {
                    this.pos++
                    this.emit(itemText)
                    return this.lexEOF;
                }
            }
        }
    }


    lexStartBold() {
        this.pos += twoAstrisks.length;
        this.emit(itemStartBold)
        return this.lexInsideBold
    }

    lexInsideBold() {
        while(true) {
            const incomingText = this.input.substring(this.pos)
            if (incomingText.startsWith(oneAstrisk)) {
                this.emit(itemText)
                return this.lexEndBold
            }
            
            const r = this.next()
            switch(r) {
                case '\n': {
                    this.pop()
                    this.emit(itemText)
                    return this.lexNewline;
                }
                case eof: {
                    this.pop()
                    this.emit(itemText)
                    return this.lexEOF;
                }
            }
        }
    }

    lexEndBold() {
        this.pos += twoAstrisks.length;
        this.emit(itemEndBold)
        return this.lexText
    }

    lexStartItalic() {
        this.pos += oneAstrisk.length;
        this.emit(itemStartItalic)
        return this.lexInsideItalic
    }

    lexInsideItalic() {
        while(true) {
            const incomingText = this.input.substring(this.pos)
            if (incomingText.startsWith(twoAstrisks)) {
                this.emit(itemText)
                return this.lexEndItalic

            }
            
            const r = this.next()
            switch(r) {
                case '\n': {
                    this.pop()
                    this.emit(itemText)
                    return this.lexNewline;
                    break
                }
                case eof: {
                    this.pop()
                    this.emit(itemText)
                    return this.lexEOF;
                    break
                }
            }
        }
    }

    lexEndItalic() {
        this.pos += oneAstrisk.length;
        this.emit(itemEndItalic)
        return this.lexText
    }

    lexNewline() {
        const r = this.next()
        this.ignore()
        switch(r) {
            case heading: return this.lexHeading;
            case newline: return this.lexLinebreak;
            case eof: return this.lexEOF;
            default: {
                if (r.search(/\d/) !== -1) {
                    return this.lexOrderedListItem;
                } else if (r.search(/\-|\+|\*/) !== -1) {
                    return this.lexUnorderedListItem;
                }
                return this.lexText;
            }
        }
    }

    lexLinebreak() {
        this.acceptRun('\n')
        this.emit(itemLinebreak)
        // Almost the same as in lexNewline
        const r = this.next()
        this.ignore()
        switch(r) {
            case heading: return this.lexHeading;
            case eof: return this.lexEOF;
            default: {
                if (r.search(/\d/) !== -1) {
                    return this.lexOrderedListItem;
                } else if (r.search(/\-|\+|\*/) !== -1) {
                    return this.lexUnorderedListItem;
                }
                return this.lexText;
            }
        }
    }

    lexOrderedListItem() {
        this.acceptRun("1234567890.)- ")
        this.ignore()
        while(true) {
            const r = this.next()
            switch(r) {
                case '\n': {
                    this.emit(itemOrderedListItem)
                    return this.lexNewline
                }

                case eof: {
                    this.emit(itemOrderedListItem)
                    return this.lexEOF;
                }
            }
        }
    }

    lexUnorderedListItem() {
        let r = this.next()
        this.ignore()
        while(true) {
            r = this.next()
            switch(r) {
                case newline: {
                    this.emit(itemUnorderedListItem)
                    return this.lexNewline
                }

                case eof: {
                    this.emit(itemUnorderedListItem)
                    return this.lexEOF;
                }
            }
        }
    }

    lexHeading() {
        let idx = this.input.indexOf('\n', this.pos);
        let sub = this.input.substring(this.pos, idx);
        if (idx >= 0) {
            let count = countConsecutive(sub, heading);
            this.start += count
            this.pos += idx - 1;
            switch(count) {
                case 1: this.emit(itemH1); break
                case 2: this.emit(itemH2); break
                case 3: this.emit(itemH3); break
            }
        }
        return this.lexNewline
    }

    lexEOF() {
        this.emit(itemEOF)
        return null
    }
}

function countConsecutive(str, char) {
    let saw = false;
    let count = 0;
    for(let i = 0; i < str.length; i++) {
        if (saw === false) {
            if (str[i] === char) {
                saw = true;
            }
        }
        if (saw === true) {
            if (str[i] === char) {
                count++;
            } else {
                break
            }
        }
    }
    return count;
}


// let input = `

// The quick **brown** fox jumped over the *lazy
// * dog.`
// let input = `السلام عليكم **ورحمة الله** وبركاته`
// let input = `
// # head1
// ## head2
// ### head3
// Hello #3 is good.
// `
let input = `
# Head1
parggoywa you **bold**

1. one
2. two
3. three
4.four
yay
- ich
* nee
+ san

`
const lexer = new Lexer(input)
lexer.run()
console.log(lexer.items)

let html = "";
lexer.items.forEach(item => {
    switch (item.typ) {
        case itemText: html += item.val; break
        case itemStartBold: html += "<b>"; break
        case itemEndBold: html += "</b>"; break
        case itemStartItalic: html += "<i>"; break
        case itemEndItalic: html += "</i>\n"; break
        case itemLinebreak: html += "\n<br/>\n"; break
        // case itemNewline: html += "\n"; break
        case itemH1: html += "<h1>"+ item.val +"</h1>\n"; break
        case itemH2: html += "<h2>"+ item.val +"</h2>\n"; break
        case itemH3: html += "<h3>"+ item.val +"</h3>\n"; break
        case itemOrderedListItem: html += "<li>"+ item.val +"</li>\n"; break
        case itemUnorderedListItem: html += "<li>"+ item.val +"</li>\n"; break
    }
})
console.log("input:", input)
console.log("output:", html)