import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { load } from 'cheerio';

export function extractDocumentedClusterPayload(sources) {
    const results = [];

    for (const source of sources) {
        if (source.kind !== 'document' || source.url !== 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html') continue;

        const $ = load(source.text, { sourceCodeLocationInfo: true });
        
        const codeBlocks = $('pre > code').toArray();
        for (const codeEl of codeBlocks) {
            const allElements = $('h2, h3, pre > code').toArray();
            const elIndex = allElements.indexOf(codeEl);
            
            let nearestH2 = null;
            let nearestH3 = null;
            
            for (let i = elIndex - 1; i >= 0; i--) {
                const el = allElements[i];
                if ($(el).is('h2') && !nearestH2) nearestH2 = el;
                if ($(el).is('h3') && !nearestH3) nearestH3 = el;
                if (nearestH2 && nearestH3) break;
            }
            
            if (!nearestH2 || !nearestH3) continue;
            if ($(nearestH2).text().trim() !== 'Tmapv3.extension.MarkerCluster') continue;
            if ($(nearestH3).text().trim() !== 'Constructor') continue;

            const code = $(codeEl).text();
            
            let ast;
            try {
                ast = acorn.parse(code, { ecmaVersion: 'latest', locations: true });
            } catch (e) {
                continue;
            }

            walk.simple(ast, {
                NewExpression(node) {
                    if (isMarkerCluster(node.callee)) {
                        const options = node.arguments[0];
                        if (options && options.type === 'ObjectExpression') {
                            const onClusterClick = options.properties.find(
                                p => p.key.type === 'Identifier' && p.key.name === 'onClusterClick'
                            );
                            
                            if (onClusterClick && (onClusterClick.value.type === 'FunctionExpression' || onClusterClick.value.type === 'ArrowFunctionExpression')) {
                                const callback = onClusterClick.value;
                                if (callback.params.length > 0) {
                                    const clusterParam = callback.params[0];
                                    if (clusterParam.type === 'Identifier') {
                                        const paramName = clusterParam.name;
                                        
                                        const shadowed = new Set();
                                        
                                        walk.ancestor(callback.body, {
                                            FunctionExpression(n, state, anc) {
                                                if (n.params.some(p => p.type === 'Identifier' && p.name === paramName)) {
                                                    shadowed.add(n);
                                                }
                                            },
                                            ArrowFunctionExpression(n, state, anc) {
                                                if (n.params.some(p => p.type === 'Identifier' && p.name === paramName)) {
                                                    shadowed.add(n);
                                                }
                                            },
                                            FunctionDeclaration(n, state, anc) {
                                                if (n.params.some(p => p.type === 'Identifier' && p.name === paramName)) {
                                                    shadowed.add(n);
                                                }
                                            },
                                            ClassDeclaration(n, state, anc) {
                                                if (n.id && n.id.name === paramName) {
                                                    let scopeNode = null;
                                                    for (let i = anc.length - 1; i >= 0; i--) {
                                                         if (anc[i].type === 'BlockStatement' || anc[i].type === 'Program') {
                                                             scopeNode = anc[i];
                                                             break;
                                                         }
                                                    }
                                                    if (scopeNode) shadowed.add(scopeNode);
                                                }
                                            },
                                            VariableDeclarator(n, state, anc) {
                                                if (n.id.type === 'Identifier' && n.id.name === paramName) {
                                                    const decl = anc[anc.length - 2];
                                                    if (decl.type === 'VariableDeclaration' && (decl.kind === 'let' || decl.kind === 'const')) {
                                                        let scopeNode = null;
                                                        for (let i = anc.length - 1; i >= 0; i--) {
                                                             if (anc[i].type === 'BlockStatement' || anc[i].type === 'Program') {
                                                                 scopeNode = anc[i];
                                                                 break;
                                                             }
                                                        }
                                                        if (scopeNode) shadowed.add(scopeNode);
                                                    }
                                                }
                                            },
                                            CatchClause(n, state, anc) {
                                                if (n.param && n.param.type === 'Identifier' && n.param.name === paramName) {
                                                    shadowed.add(n.body);
                                                }
                                            },
                                            MemberExpression(memNode, ancestors) {
                                                if (memNode.computed) return;

                                                // Check for nested functions
                                                for (let i = 0; i < ancestors.length - 1; i++) {
                                                    if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression'].includes(ancestors[i].type)) {
                                                        return;
                                                    }
                                                }

                                                // Lexical shadowing check (basic)
                                                let isShadowed = false;
                                                for (const anc of ancestors) {
                                                    if (shadowed.has(anc)) {
                                                        isShadowed = true;
                                                        break;
                                                    }
                                                }
                                                if (isShadowed) return;

                                                if (memNode.object.type === 'Identifier' && memNode.object.name === paramName &&
                                                    memNode.property.type === 'Identifier') {
                                                    
                                                    let isModified = false;
                                                    for (let i = ancestors.length - 2; i >= 0; i--) {
                                                        const parent = ancestors[i];
                                                        if (parent.type === 'AssignmentExpression' && parent.left === ancestors[i+1]) {
                                                            isModified = true;
                                                            break;
                                                        }
                                                        if (parent.type === 'UpdateExpression' && parent.argument === ancestors[i+1]) {
                                                            isModified = true;
                                                            break;
                                                        }
                                                        if (parent.type === 'UnaryExpression' && parent.operator === 'delete' && parent.argument === ancestors[i+1]) {
                                                            isModified = true;
                                                            break;
                                                        }
                                                    }
                                                    
                                                    if (!isModified) {
                                                        results.push({
                                                            kind: 'documented-callback-field',
                                                            id: `Tmapv3.extension.MarkerCluster#constructor:onClusterClick:argument[0].${memNode.property.name}`,
                                                            owner: 'Tmapv3.extension.MarkerCluster',
                                                            name: `onClusterClick:argument[0].${memNode.property.name}`,
                                                            parentId: `Tmapv3.extension.MarkerCluster#constructor:onClusterClick`,
                                                            type: null,
                                                            contract: `read of ${memNode.property.name} on callback argument`,
                                                            evidence: [{
                                                                channel: 'example',
                                                                source: source.url,
                                                                sha256: source.sha256,
                                                                line: codeEl.sourceCodeLocation.startLine + memNode.loc.start.line - 1
                                                            }],
                                                            start: memNode.start,
                                                            end: memNode.end,
                                                            blockLine: codeEl.sourceCodeLocation.startLine
                                                        });
                                                    }
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    return results;
}

function isMarkerCluster(callee) {
    return memberPath(callee) === 'Tmapv3.extension.MarkerCluster';
}

function memberPath(node) {
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
        const obj = memberPath(node.object);
        const prop = node.property.name;
        if (obj && prop) return obj + '.' + prop;
    }
    return null;
}
